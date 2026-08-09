import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorDocumentSnapshot, SaveEditorDocumentResult } from "@desk/core";
import {
  EditorSessionController,
  prepareEditorContextTransition,
  registerEditorSession,
} from "../../packages/app/src/lib/editor-session-controller";

function taskSnapshot(
  revision: string,
  body: string,
  title = "Ship",
): EditorDocumentSnapshot {
  return {
    kind: "task",
    ref: { kind: "task", workspaceId: "acme", projectId: "website", id: "ship" },
    filePath: "/desk/workspaces/acme/projects/website/tasks/ship.md",
    revision,
    body,
    metadata: { title, status: "todo" },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("EditorSessionController", () => {
  it("blocks an editor-context transition when an active editor cannot flush", async () => {
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(async () => ({ status: "missing" as const, reason: "document" as const })),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });
    const unregister = registerEditorSession("transition-test", controller);
    controller.editBody("unsaved");

    await expect(prepareEditorContextTransition()).resolves.toBe(false);
    expect(controller.getSnapshot().dirtyFields).toEqual(new Set(["body"]));

    unregister();
    controller.dispose();
  });

  it("never becomes falsely clean when edits arrive during a slow save", async () => {
    vi.useFakeTimers();
    const first = deferred<SaveEditorDocumentResult>();
    const saves: Array<{ revision: string | null; patch: unknown }> = [];
    const save = vi.fn(async (revision: string | null, patch: unknown) => {
      saves.push({ revision, patch });
      if (saves.length === 1) return first.promise;
      return { status: "saved", snapshot: taskSnapshot("r3", "second") } as const;
    });
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save,
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });

    controller.editBody("first");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledTimes(1);
    controller.editBody("second");
    first.resolve({ status: "saved", snapshot: taskSnapshot("r2", "first") });
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(saves[1]).toMatchObject({ revision: "r2", patch: { kind: "task", body: "second" } });
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", draft: { body: "second" } });
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    controller.dispose();
  });

  it("keeps only Desk-changed fields when resolving a conflict", async () => {
    const external = taskSnapshot("r2", "external body", "External title");
    const save = vi.fn()
      .mockResolvedValueOnce({ status: "conflict", current: external })
      .mockResolvedValueOnce({ status: "saved", snapshot: taskSnapshot("r3", "Desk body", "External title") });
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save,
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });
    controller.editBody("Desk body");
    expect(await controller.flush()).toBe(false);
    controller.keepDesk();
    await Promise.resolve();
    await Promise.resolve();
    await controller.flush();

    expect(save.mock.calls[1][0]).toBe("r2");
    expect(save.mock.calls[1][1]).toEqual({ kind: "task", body: "Desk body" });
    expect(controller.getSnapshot().draft.metadata.title).toBe("External title");
    controller.dispose();
  });

  it("opens recovery as a conflict when its base revision changed", () => {
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r2", "external"),
      recovery: {
        version: 1,
        namespace: "local:/desk",
        entityKey: "task",
        ref: { kind: "task", workspaceId: "acme", projectId: "website", id: "ship" },
        baseRevision: "r1",
        baseSnapshot: taskSnapshot("r1", "original"),
        draft: { body: "recovered", metadata: {} },
        editVersion: 3,
        timestamp: Date.now(),
      },
      save: vi.fn(),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });
    expect(controller.getSnapshot()).toMatchObject({
      status: "conflict",
      draft: { body: "recovered" },
      restoredRecovery: true,
    });
    controller.dispose();
  });

  it("never persists an empty title and restores it on explicit flush", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save,
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });

    controller.editMetadata("title", "");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(save).not.toHaveBeenCalled();
    expect(controller.getSnapshot().dirtyFields.has("metadata.title")).toBe(true);
    await expect(controller.flush()).resolves.toBe(true);
    expect(controller.getSnapshot().draft.metadata.title).toBe("Ship");
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    expect(save).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("recreates a missing file from a recovered draft and its confirmed base", async () => {
    const base = taskSnapshot("r1", "original");
    const recovery = {
      version: 1 as const,
      namespace: "local:/desk",
      entityKey: "task",
      ref: base.ref,
      baseRevision: base.revision,
      baseSnapshot: base,
      draft: { body: "recovered body", metadata: { title: "Recovered title" } },
      editVersion: 4,
      timestamp: Date.now(),
    };
    const recreate = vi.fn(async () => ({
      status: "saved" as const,
      snapshot: taskSnapshot("r2", "recovered body", "Recovered title"),
    }));
    const controller = new EditorSessionController({
      snapshot: recovery.baseSnapshot,
      recovery,
      save: vi.fn(),
      recreate,
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });

    controller.markMissing();
    await expect(controller.recreate()).resolves.toBe(true);
    expect(recreate).toHaveBeenCalledWith(
      base,
      expect.objectContaining({
        kind: "task",
        body: "recovered body",
        title: "Recovered title",
      }),
    );
    expect(controller.getSnapshot()).toMatchObject({
      status: "idle",
      draft: { body: "recovered body", metadata: { title: "Recovered title" } },
    });
    controller.dispose();
  });

  it("keeps a missing-parent recovery draft retryable", async () => {
    const base = taskSnapshot("r1", "original");
    const controller = new EditorSessionController({
      snapshot: base,
      recovery: {
        version: 1,
        namespace: "local:/desk",
        entityKey: "task",
        ref: base.ref,
        baseRevision: base.revision,
        baseSnapshot: base,
        draft: { body: "protected draft", metadata: {} },
        editVersion: 1,
        timestamp: Date.now(),
      },
      save: vi.fn(),
      recreate: vi.fn(async () => ({ status: "missing" as const, reason: "parent" as const })),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => undefined),
    });
    controller.markMissing();

    await expect(controller.recreate()).resolves.toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      status: "missing",
      recoveryBlocked: "parent-missing",
      draft: { body: "protected draft" },
    });
    expect(controller.getSnapshot().dirtyFields).toEqual(new Set(["body"]));
    controller.dispose();
  });

  it("serializes recovery clearing after an in-flight draft write", async () => {
    const write = deferred<void>();
    const events: string[] = [];
    const clearRecovery = vi.fn(async () => { events.push("clear"); });
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(),
      persistRecovery: vi.fn(async () => {
        events.push("write-start");
        await write.promise;
        events.push("write-end");
      }),
      clearRecovery,
    });

    controller.editBody("Desk draft");
    await Promise.resolve();
    await Promise.resolve();
    controller.adoptCanonical(taskSnapshot("r2", "external"));
    controller.useExternal();
    expect(clearRecovery).not.toHaveBeenCalled();

    write.resolve();
    await vi.waitFor(() => expect(clearRecovery).toHaveBeenCalledTimes(1));

    expect(events).toEqual(["write-start", "write-end", "clear"]);
    controller.dispose();
  });

  it("stays canonically clean when clearing a saved recovery entry fails", async () => {
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(async () => ({
        status: "saved" as const,
        snapshot: taskSnapshot("r2", "saved"),
      })),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => { throw new Error("IndexedDB unavailable"); }),
    });

    controller.editBody("saved");
    await expect(controller.flush()).resolves.toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      status: "idle",
      recoveryFailed: true,
      draft: { body: "saved" },
    });
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    controller.dispose();
  });

  it("keeps a discarded draft open when recovery cleanup fails", async () => {
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery: vi.fn(async () => { throw new Error("IndexedDB unavailable"); }),
    });

    controller.editBody("draft to discard");
    await expect(controller.discard()).resolves.toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      recoveryFailed: true,
      draft: { body: "draft to discard" },
    });
    expect(controller.getSnapshot().dirtyFields).toEqual(new Set(["body"]));
    controller.dispose();
  });

  it("clears recovery before confirming a discard", async () => {
    const clearRecovery = vi.fn(async () => undefined);
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery,
    });

    controller.editBody("draft to discard");
    await expect(controller.discard()).resolves.toBe(true);
    expect(clearRecovery).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      recoveryFailed: false,
      draft: { body: "original" },
    });
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    controller.dispose();
  });

  it("allows a failed discard to be retried without losing the draft", async () => {
    const clearRecovery = vi.fn()
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"))
      .mockResolvedValueOnce(undefined);
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery,
    });

    controller.editBody("draft to discard");
    await expect(controller.discard()).resolves.toBe(false);
    expect(controller.getSnapshot().draft.body).toBe("draft to discard");

    await expect(controller.discard()).resolves.toBe(true);
    expect(controller.getSnapshot().draft.body).toBe("original");
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    expect(clearRecovery).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it("does not erase an edit made while recovery is being cleared", async () => {
    const clearing = deferred<void>();
    const clearRecovery = vi.fn(async () => clearing.promise);
    const persistRecovery = vi.fn(async () => undefined);
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(),
      persistRecovery,
      clearRecovery,
    });

    controller.editBody("first draft");
    const discard = controller.discard();
    await vi.waitFor(() => expect(clearRecovery).toHaveBeenCalledTimes(1));
    controller.editBody("newer draft");
    clearing.resolve();

    await expect(discard).resolves.toBe(false);
    expect(controller.getSnapshot().draft.body).toBe("newer draft");
    expect(controller.getSnapshot().dirtyFields).toEqual(new Set(["body"]));
    expect(persistRecovery).toHaveBeenLastCalledWith(
      expect.anything(),
      { body: "newer draft", metadata: {} },
      2,
    );
    controller.dispose();
  });

  it("does not turn a confirmed save into an error when post-save synchronization throws", async () => {
    const clearRecovery = vi.fn(async () => undefined);
    const controller = new EditorSessionController({
      snapshot: taskSnapshot("r1", "original"),
      save: vi.fn(async () => ({
        status: "saved" as const,
        snapshot: taskSnapshot("r2", "saved"),
      })),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery,
      onSaved: () => { throw new Error("broken cache patch"); },
    });

    controller.editBody("saved");
    await expect(controller.flush()).resolves.toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      status: "idle",
      error: null,
      confirmed: { revision: "r2", body: "saved" },
    });
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    expect(clearRecovery).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("drops stale recovery when its changes are already canonical", async () => {
    const canonical = taskSnapshot("r2", "saved");
    const clearRecovery = vi.fn(async () => undefined);
    const controller = new EditorSessionController({
      snapshot: canonical,
      recovery: {
        version: 1,
        namespace: "remote:https://desk.example:user",
        entityKey: "task",
        ref: canonical.ref,
        baseRevision: "r1",
        baseSnapshot: taskSnapshot("r1", "original"),
        draft: { body: "saved", metadata: {} },
        editVersion: 2,
        timestamp: Date.now(),
      },
      save: vi.fn(),
      persistRecovery: vi.fn(async () => undefined),
      clearRecovery,
    });

    expect(controller.getSnapshot()).toMatchObject({
      status: "idle",
      restoredRecovery: false,
      conflict: null,
    });
    expect(controller.getSnapshot().dirtyFields.size).toBe(0);
    await vi.waitFor(() => expect(clearRecovery).toHaveBeenCalledTimes(1));
    controller.dispose();
  });
});
