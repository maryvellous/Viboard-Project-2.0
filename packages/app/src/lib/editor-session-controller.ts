import type {
  EditorDocumentPatch,
  EditorDocumentSnapshot,
  SaveEditorDocumentResult,
} from "@desk/core";
import type {
  EditorRecoveryDraft,
  EditorRecoveryRecord,
} from "./editor-recovery";

export type EditorSessionStatus =
  | "idle"
  | "scheduled"
  | "saving"
  | "error"
  | "conflict"
  | "missing";

export interface EditorSessionDraft {
  body: string;
  metadata: Record<string, unknown>;
}

export interface EditorSessionState {
  confirmed: EditorDocumentSnapshot;
  draft: EditorSessionDraft;
  editVersion: number;
  dirtyFields: ReadonlySet<string>;
  status: EditorSessionStatus;
  conflict: EditorDocumentSnapshot | null;
  error: Error | null;
  recoveryFailed: boolean;
  restoredRecovery: boolean;
  recoveryBlocked: "parent-missing" | null;
}

export interface EditorSessionControllerOptions {
  snapshot: EditorDocumentSnapshot;
  recovery?: EditorRecoveryRecord | null;
  save: (
    expectedRevision: string | null,
    patch: EditorDocumentPatch,
  ) => Promise<SaveEditorDocumentResult>;
  recreate?: (
    baseSnapshot: EditorDocumentSnapshot,
    patch: EditorDocumentPatch,
  ) => Promise<SaveEditorDocumentResult>;
  persistRecovery: (
    baseSnapshot: EditorDocumentSnapshot,
    draft: EditorRecoveryDraft,
    editVersion: number,
  ) => Promise<void>;
  clearRecovery: () => Promise<void>;
  onSaved?: (snapshot: EditorDocumentSnapshot) => void;
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

const TEXT_DELAY_MS = 1_000;
const MAX_WAIT_MS = 5_000;
const RECOVERY_DELAY_MS = 250;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000] as const;

export class EditorSessionController {
  private state: EditorSessionState;
  private readonly listeners = new Set<() => void>();
  private readonly options: EditorSessionControllerOptions;
  private trailingTimer: ReturnType<typeof setTimeout> | null = null;
  private maximumTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private canonicalRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private firstUncommittedAt: number | null = null;
  private savePromise: Promise<boolean> | null = null;
  private recoveryPromise: Promise<void> = Promise.resolve();
  private retryIndex = 0;
  private canonicalRetryIndex = 0;
  private disposed = false;

  constructor(options: EditorSessionControllerOptions) {
    this.options = options;
    const baseDraft = draftFromSnapshot(options.snapshot);
    const recovery = options.recovery;
    const recoveryPatch = recovery?.draft;
    const draft = recoveryPatch
      ? applyRecoveryDraft(baseDraft, recoveryPatch)
      : baseDraft;
    // A request may have committed successfully and then failed in client-side
    // follow-up work. Compare recovery against today's canonical snapshot so an
    // already-saved draft does not become a false conflict on reload.
    const dirtyFields = recoveryPatch
      ? computeDirtyFields(options.snapshot, draft)
      : new Set<string>();
    const revisionChanged = Boolean(
      recovery
      && dirtyFields.size > 0
      && recovery.baseRevision !== options.snapshot.revision,
    );
    this.state = {
      confirmed: options.snapshot,
      draft,
      editVersion: recovery?.editVersion ?? 0,
      dirtyFields,
      status: revisionChanged ? "conflict" : dirtyFields.size ? "scheduled" : "idle",
      conflict: revisionChanged ? options.snapshot : null,
      error: null,
      recoveryFailed: false,
      restoredRecovery: Boolean(recovery && dirtyFields.size > 0),
      recoveryBlocked: null,
    };
    if (recovery && dirtyFields.size === 0) {
      void this.clearRecoveryAfterPendingWrites();
    }
    if (dirtyFields.size) {
      this.firstUncommittedAt = this.now();
      this.scheduleRecovery();
      if (!revisionChanged) this.scheduleCanonical(false);
    }
  }

  getSnapshot = (): EditorSessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  editBody(body: string): void {
    if (body === this.state.draft.body) return;
    this.edit({ ...this.state.draft, body }, "body", false);
  }

  editMetadata(field: string, value: unknown, immediate = false): void {
    if (Object.is(this.state.draft.metadata[field], value)) return;
    this.edit(
      {
        ...this.state.draft,
        metadata: { ...this.state.draft.metadata, [field]: value },
      },
      `metadata.${field}`,
      immediate,
    );
  }

  restoreEmptyTitle(): void {
    if (!("title" in this.state.draft.metadata)) return;
    const title = this.state.draft.metadata.title;
    if (typeof title === "string" && title.trim()) {
      void this.flush();
      return;
    }
    this.editMetadata(
      "title",
      (this.state.confirmed.metadata as unknown as Record<string, unknown>).title,
    );
  }

  async flush(automatic = false): Promise<boolean> {
    this.clearCanonicalTimers();
    if (this.state.status === "conflict" || this.state.status === "missing") return false;
    if (!automatic) this.restoreEmptyTitleForFlush();
    if (this.savePromise) {
      await this.savePromise;
      if (this.state.dirtyFields.size) {
        return this.flush(automatic);
      }
      return this.state.dirtyFields.size === 0;
    }
    if (this.state.dirtyFields.size === 0) return true;
    if (!this.hasPersistableDirtyFields()) return automatic;
    if (this.recoveryTimer) {
      this.clearTimer(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    await this.persistRecovery();
    this.savePromise = this.performSave().finally(() => {
      this.savePromise = null;
    });
    const result = await this.savePromise;
    if (result && this.state.dirtyFields.size) return this.flush(automatic);
    return result && this.state.dirtyFields.size === 0;
  }

  retry(): void {
    if (this.state.status !== "error") return;
    if (this.state.dirtyFields.size === 0) {
      this.setState({ ...this.state, status: "idle", error: null });
      void this.clearRecoveryAfterPendingWrites();
      return;
    }
    this.canonicalRetryIndex = 0;
    if (this.canonicalRetryTimer) this.clearTimer(this.canonicalRetryTimer);
    this.canonicalRetryTimer = null;
    this.setState({ ...this.state, status: "scheduled", error: null });
    void this.flush();
  }

  adoptCanonical(snapshot: EditorDocumentSnapshot): void {
    if (snapshot.revision === this.state.confirmed.revision) return;
    if (
      this.state.dirtyFields.size === 0
      && this.state.status !== "saving"
      && this.state.status !== "scheduled"
    ) {
      this.setState({
        ...this.state,
        confirmed: snapshot,
        draft: draftFromSnapshot(snapshot),
        status: "idle",
        conflict: null,
        error: null,
        recoveryBlocked: null,
      });
      return;
    }
    this.clearCanonicalTimers();
    this.setState({
      ...this.state,
      status: "conflict",
      conflict: snapshot,
    });
  }

  useExternal(): void {
    const external = this.state.conflict;
    if (!external) return;
    this.clearCanonicalTimers();
    this.setState({
      ...this.state,
      confirmed: external,
      draft: draftFromSnapshot(external),
      dirtyFields: new Set(),
      status: "idle",
      conflict: null,
      error: null,
      recoveryBlocked: null,
    });
    void this.clearRecoveryAfterPendingWrites();
  }

  async discard(): Promise<boolean> {
    this.clearCanonicalTimers();
    if (this.recoveryTimer) {
      this.clearTimer(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    if (this.retryTimer) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.savePromise) await this.savePromise;

    const discardVersion = this.state.editVersion;
    await this.recoveryPromise.catch(() => undefined);
    if (this.state.editVersion !== discardVersion) return false;

    try {
      await this.options.clearRecovery();
    } catch (error) {
      console.error("[editor-session] Could not discard recovery draft:", error);
      this.setState({ ...this.state, recoveryFailed: true });
      return false;
    }

    // An edit made while IndexedDB was clearing must not be discarded. Re-persist
    // that newer draft and leave the editor open for another explicit decision.
    if (this.state.editVersion !== discardVersion) {
      await this.persistRecovery();
      return false;
    }

    const canonical = this.state.conflict ?? this.state.confirmed;
    this.firstUncommittedAt = null;
    this.retryIndex = 0;
    this.setState({
      ...this.state,
      confirmed: canonical,
      draft: draftFromSnapshot(canonical),
      dirtyFields: new Set(),
      status: "idle",
      conflict: null,
      error: null,
      recoveryFailed: false,
      recoveryBlocked: null,
    });
    return true;
  }

  keepDesk(): void {
    const external = this.state.conflict;
    if (!external) return;
    const changed = this.recoveryDraft();
    this.setState({
      ...this.state,
      confirmed: external,
      draft: applyRecoveryDraft(draftFromSnapshot(external), changed),
      dirtyFields: recoveryDirtyFields(changed),
      status: "scheduled",
      conflict: null,
      error: null,
      editVersion: this.state.editVersion + 1,
    });
    this.firstUncommittedAt = this.now();
    this.scheduleRecovery();
    void this.flush();
  }

  cancelConflict(): void {
    // Conflict remains intentionally paused. Recovery already protects the draft.
    this.scheduleRecovery();
  }

  markMissing(): void {
    this.clearCanonicalTimers();
    this.setState({ ...this.state, status: "missing", recoveryBlocked: null });
    this.scheduleRecovery();
  }

  async recreate(): Promise<boolean> {
    if (this.state.status !== "missing" || !this.options.recreate) return false;
    this.restoreEmptyTitleForFlush();
    await this.persistRecovery();
    this.setState({ ...this.state, status: "saving", error: null, recoveryBlocked: null });
    try {
      const result = await this.options.recreate(
        this.state.confirmed,
        this.fullEditorPatch(),
      );
      if (result.status === "conflict") {
        this.setState({ ...this.state, status: "conflict", conflict: result.current });
        return false;
      }
      if (result.status === "missing") {
        this.setState({
          ...this.state,
          status: "missing",
          recoveryBlocked: result.reason === "parent" ? "parent-missing" : null,
        });
        return false;
      }
      this.firstUncommittedAt = null;
      this.setState({
        ...this.state,
        confirmed: result.snapshot,
        draft: draftFromSnapshot(result.snapshot),
        dirtyFields: new Set(),
        status: "idle",
        conflict: null,
        error: null,
        recoveryBlocked: null,
      });
      this.notifySaved(result.snapshot);
      await this.clearRecoveryAfterPendingWrites();
      return true;
    } catch (error) {
      this.setState({
        ...this.state,
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        recoveryBlocked: null,
      });
      this.scheduleRecovery();
      return false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearCanonicalTimers();
    if (this.recoveryTimer) this.clearTimer(this.recoveryTimer);
    if (this.retryTimer) this.clearTimer(this.retryTimer);
    if (this.canonicalRetryTimer) this.clearTimer(this.canonicalRetryTimer);
    this.listeners.clear();
  }

  private edit(draft: EditorSessionDraft, field: string, immediate: boolean): void {
    const wasClean = this.state.dirtyFields.size === 0;
    const dirtyFields = new Set(this.state.dirtyFields);
    const canonicalValue = field === "body"
      ? this.state.confirmed.body
      : (this.state.confirmed.metadata as unknown as Record<string, unknown>)[field.slice("metadata.".length)];
    const draftValue = field === "body"
      ? draft.body
      : draft.metadata[field.slice("metadata.".length)];
    if (Object.is(canonicalValue, draftValue)) dirtyFields.delete(field);
    else dirtyFields.add(field);

    if (this.firstUncommittedAt === null && dirtyFields.size) {
      this.firstUncommittedAt = this.now();
    }
    this.setState({
      ...this.state,
      draft,
      dirtyFields,
      editVersion: this.state.editVersion + 1,
      status: this.state.status === "conflict"
        ? "conflict"
        : dirtyFields.size
          ? "scheduled"
          : "idle",
      error: null,
    });
    if (dirtyFields.size) {
      if (wasClean) void this.persistRecovery();
      this.scheduleRecovery();
      if (this.state.status !== "conflict") this.scheduleCanonical(immediate);
    } else {
      this.firstUncommittedAt = null;
      this.clearCanonicalTimers();
      void this.clearRecoveryAfterPendingWrites();
    }
  }

  private scheduleCanonical(immediate: boolean): void {
    if (this.disposed || this.state.status === "conflict" || this.state.status === "missing") return;
    if (this.trailingTimer) this.clearTimer(this.trailingTimer);
    this.trailingTimer = this.setTimer(() => void this.flush(true), immediate ? 0 : TEXT_DELAY_MS);
    if (!this.maximumTimer) {
      const elapsed = this.firstUncommittedAt === null ? 0 : this.now() - this.firstUncommittedAt;
      this.maximumTimer = this.setTimer(
        () => void this.flush(true),
        Math.max(0, MAX_WAIT_MS - elapsed),
      );
    }
  }

  private scheduleRecovery(): void {
    if (this.disposed || this.state.dirtyFields.size === 0) return;
    if (this.recoveryTimer) this.clearTimer(this.recoveryTimer);
    this.recoveryTimer = this.setTimer(() => {
      this.recoveryTimer = null;
      void this.persistRecovery();
    }, RECOVERY_DELAY_MS);
  }

  private persistRecovery(): Promise<void> {
    const baseSnapshot = this.state.confirmed;
    const draft = this.recoveryDraft();
    const editVersion = this.state.editVersion;
    this.recoveryPromise = this.recoveryPromise
      .catch(() => undefined)
      .then(() => this.options.persistRecovery(baseSnapshot, draft, editVersion))
      .then(() => {
        if (this.state.recoveryFailed) {
          this.setState({ ...this.state, recoveryFailed: false });
        }
        this.retryIndex = 0;
      })
      .catch(() => {
        this.setState({ ...this.state, recoveryFailed: true });
        this.scheduleRetry();
      });
    return this.recoveryPromise;
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.disposed) return;
    const delay = RETRY_DELAYS_MS[Math.min(this.retryIndex, RETRY_DELAYS_MS.length - 1)];
    this.retryIndex++;
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      if (this.state.dirtyFields.size) void this.persistRecovery();
      else if (this.state.recoveryFailed) void this.clearRecoveryAfterPendingWrites();
    }, delay);
  }

  private async performSave(): Promise<boolean> {
    const capturedVersion = this.state.editVersion;
    const patch = this.editorPatch();
    const expectedRevision = this.state.confirmed.revision;
    this.setState({ ...this.state, status: "saving", error: null });
    try {
      const result = await this.options.save(expectedRevision, patch);
      if (result.status === "conflict") {
        this.setState({ ...this.state, status: "conflict", conflict: result.current });
        this.scheduleRecovery();
        return false;
      }
      if (result.status === "missing") {
        this.markMissing();
        return false;
      }

      const draft = capturedVersion === this.state.editVersion
        ? draftFromSnapshot(result.snapshot)
        : this.state.draft;
      const dirtyFields = capturedVersion === this.state.editVersion
        ? new Set<string>()
        : computeDirtyFields(result.snapshot, draft);
      this.firstUncommittedAt = dirtyFields.size ? this.now() : null;
      this.retryIndex = 0;
      this.canonicalRetryIndex = 0;
      this.setState({
        ...this.state,
        confirmed: result.snapshot,
        draft,
        dirtyFields,
        status: dirtyFields.size ? "scheduled" : "idle",
        conflict: null,
        error: null,
        recoveryBlocked: null,
      });
      this.notifySaved(result.snapshot);
      if (dirtyFields.size === 0) {
        await this.clearRecoveryAfterPendingWrites();
      }
      else {
        this.scheduleRecovery();
        if (this.hasPersistableDirtyFields()) this.scheduleCanonical(true);
      }
      return true;
    } catch (error) {
      console.error("[editor-session] Canonical save failed:", error);
      this.setState({
        ...this.state,
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        recoveryBlocked: null,
      });
      this.scheduleRecovery();
      this.scheduleCanonicalRetry();
      return false;
    }
  }

  private editorPatch(): EditorDocumentPatch {
    const patch: Record<string, unknown> = { kind: this.state.confirmed.kind };
    for (const field of this.state.dirtyFields) {
      if (field === "body") patch.body = this.state.draft.body;
      else {
        const metadataField = field.slice("metadata.".length);
        const value = this.state.draft.metadata[metadataField];
        if (metadataField === "title" && typeof value === "string" && !value.trim()) continue;
        patch[metadataField] = value;
      }
    }
    return patch as unknown as EditorDocumentPatch;
  }

  /** A confirmed write stays confirmed even if a cache/UI callback fails. */
  private notifySaved(snapshot: EditorDocumentSnapshot): void {
    try {
      this.options.onSaved?.(snapshot);
    } catch (error) {
      console.error("[editor-session] Post-save synchronization failed:", error);
    }
  }

  private fullEditorPatch(): EditorDocumentPatch {
    const metadata = this.state.draft.metadata;
    switch (this.state.confirmed.kind) {
      case "task":
        return {
          kind: "task",
          body: this.state.draft.body,
          title: String(metadata.title ?? ""),
          status: metadata.status as Extract<EditorDocumentPatch, { kind: "task" }>["status"],
          priority: (metadata.priority ?? null) as Extract<EditorDocumentPatch, { kind: "task" }>["priority"],
          due: (metadata.due ?? null) as string | null,
        };
      case "document":
        return { kind: "document", body: this.state.draft.body, title: String(metadata.title ?? "") };
      case "meeting":
        return {
          kind: "meeting",
          body: this.state.draft.body,
          title: String(metadata.title ?? ""),
          date: (metadata.date ?? null) as string | null,
        };
      case "workspace-overview":
        return { kind: "workspace-overview", body: this.state.draft.body };
      case "project-overview":
        return { kind: "project-overview", body: this.state.draft.body };
    }
  }

  private recoveryDraft(): EditorRecoveryDraft {
    const metadata: Record<string, unknown> = {};
    let body: string | undefined;
    for (const field of this.state.dirtyFields) {
      if (field === "body") body = this.state.draft.body;
      else metadata[field.slice("metadata.".length)] = this.state.draft.metadata[field.slice("metadata.".length)];
    }
    return { ...(body !== undefined && { body }), metadata };
  }

  private clearCanonicalTimers(): void {
    if (this.trailingTimer) this.clearTimer(this.trailingTimer);
    if (this.maximumTimer) this.clearTimer(this.maximumTimer);
    this.trailingTimer = null;
    this.maximumTimer = null;
  }

  private hasPersistableDirtyFields(): boolean {
    for (const field of this.state.dirtyFields) {
      if (field !== "metadata.title") return true;
      const title = this.state.draft.metadata.title;
      if (typeof title !== "string" || title.trim()) return true;
    }
    return false;
  }

  private restoreEmptyTitleForFlush(): void {
    if (!this.state.dirtyFields.has("metadata.title")) return;
    const title = this.state.draft.metadata.title;
    if (typeof title !== "string" || title.trim()) return;
    const confirmedTitle = (this.state.confirmed.metadata as unknown as Record<string, unknown>).title;
    const dirtyFields = new Set(this.state.dirtyFields);
    dirtyFields.delete("metadata.title");
    this.setState({
      ...this.state,
      draft: {
        ...this.state.draft,
        metadata: { ...this.state.draft.metadata, title: confirmedTitle },
      },
      dirtyFields,
      editVersion: this.state.editVersion + 1,
      status: dirtyFields.size ? "scheduled" : "idle",
    });
    if (dirtyFields.size === 0) void this.clearRecoveryAfterPendingWrites();
  }

  /** Clear only after earlier writes settle, and never erase a newer edit's recovery. */
  private clearRecoveryAfterPendingWrites(): Promise<void> {
    const cleanVersion = this.state.editVersion;
    let attempted = false;
    this.recoveryPromise = this.recoveryPromise
      .catch(() => undefined)
      .then(async () => {
        if (
          this.state.editVersion === cleanVersion
          && this.state.dirtyFields.size === 0
        ) {
          attempted = true;
          await this.options.clearRecovery();
        }
      })
      .then(() => {
        if (!attempted) return;
        this.retryIndex = 0;
        if (this.state.recoveryFailed) {
          this.setState({ ...this.state, recoveryFailed: false });
        }
      })
      .catch(() => {
        this.setState({ ...this.state, recoveryFailed: true });
        this.scheduleRetry();
      });
    return this.recoveryPromise;
  }

  private scheduleCanonicalRetry(): void {
    if (this.canonicalRetryTimer || this.disposed) return;
    const delay = RETRY_DELAYS_MS[
      Math.min(this.canonicalRetryIndex, RETRY_DELAYS_MS.length - 1)
    ];
    this.canonicalRetryIndex++;
    this.canonicalRetryTimer = this.setTimer(() => {
      this.canonicalRetryTimer = null;
      if (this.state.status === "error") {
        this.setState({ ...this.state, status: "scheduled", error: null });
        void this.flush();
      }
    }, delay);
  }

  private setState(next: EditorSessionState): void {
    if (this.disposed) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private setTimer(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    return (this.options.setTimer ?? setTimeout)(callback, delay);
  }

  private clearTimer(timer: ReturnType<typeof setTimeout>): void {
    (this.options.clearTimer ?? clearTimeout)(timer);
  }
}

function draftFromSnapshot(snapshot: EditorDocumentSnapshot): EditorSessionDraft {
  return {
    body: snapshot.body,
    metadata: { ...snapshot.metadata },
  };
}

function applyRecoveryDraft(
  base: EditorSessionDraft,
  recovery: EditorRecoveryDraft,
): EditorSessionDraft {
  return {
    body: recovery.body ?? base.body,
    metadata: { ...base.metadata, ...recovery.metadata },
  };
}

function recoveryDirtyFields(recovery: EditorRecoveryDraft): Set<string> {
  return new Set([
    ...(recovery.body !== undefined ? ["body"] : []),
    ...Object.keys(recovery.metadata).map((field) => `metadata.${field}`),
  ]);
}

function computeDirtyFields(
  snapshot: EditorDocumentSnapshot,
  draft: EditorSessionDraft,
): Set<string> {
  const dirty = new Set<string>();
  if (draft.body !== snapshot.body) dirty.add("body");
  for (const [field, value] of Object.entries(draft.metadata)) {
    if (!Object.is(value, snapshot.metadata[field as keyof typeof snapshot.metadata])) {
      dirty.add(`metadata.${field}`);
    }
  }
  return dirty;
}

const activeEditorSessions = new Map<string, EditorSessionController>();

export function registerEditorSession(
  key: string,
  controller: EditorSessionController,
): () => void {
  activeEditorSessions.set(key, controller);
  return () => {
    if (activeEditorSessions.get(key) === controller) activeEditorSessions.delete(key);
  };
}

export async function flushAllEditorSessions(): Promise<boolean> {
  const results = await Promise.all(
    [...activeEditorSessions.values()].map((controller) => controller.flush()),
  );
  return results.every(Boolean);
}

/** Persist every active editor before changing data-root, server, or account context. */
export function prepareEditorContextTransition(): Promise<boolean> {
  return flushAllEditorSessions();
}

export async function discardAllEditorSessions(): Promise<boolean> {
  const results = await Promise.all(
    [...activeEditorSessions.values()].map((controller) => controller.discard()),
  );
  return results.every(Boolean);
}

export function flushEditorSession(key: string): Promise<boolean> {
  return activeEditorSessions.get(key)?.flush() ?? Promise.resolve(true);
}

export function discardEditorSession(key: string): Promise<boolean> {
  return activeEditorSessions.get(key)?.discard() ?? Promise.resolve(true);
}

export function getEditorSessionStatus(key: string): EditorSessionStatus | null {
  return activeEditorSessions.get(key)?.getSnapshot().status ?? null;
}

export function hasEditorRecoveryFailure(): boolean {
  return [...activeEditorSessions.values()].some(
    (controller) => controller.getSnapshot().recoveryFailed,
  );
}
