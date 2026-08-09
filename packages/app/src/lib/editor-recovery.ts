import type { EditorDocumentRef, EditorDocumentSnapshot } from "@desk/core";
import { useBootStore } from "../stores/boot";

export interface EditorRecoveryDraft {
  body?: string;
  metadata: Record<string, unknown>;
}

export interface EditorRecoveryRecord {
  version: 1;
  namespace: string;
  entityKey: string;
  ref: EditorDocumentRef;
  baseRevision: string;
  /** Confirmed record needed to reconstruct or recreate a draft if the file disappears. */
  baseSnapshot: EditorDocumentSnapshot;
  draft: EditorRecoveryDraft;
  editVersion: number;
  timestamp: number;
}

const DATABASE = "desk-editor-recovery";
const STORE = "drafts";
const DATABASE_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let authenticatedUserId: string | null = null;

export function setEditorRecoveryUser(userId: string | null): void {
  authenticatedUserId = userId;
}

export function editorRecoveryNamespace(): string {
  const boot = useBootStore.getState();
  if (import.meta.env.VITE_DESK_HOSTED) {
    return `remote:${window.location.origin}:user:${authenticatedUserId ?? "unknown"}`;
  }
  if (boot.connectionMode === "remote") {
    return `remote:${normalizeOrigin(boot.serverUrl)}:user:${authenticatedUserId ?? "unknown"}`;
  }
  return `local:${boot.dataPath || "~/DeskMD"}`;
}

export function editorRecoveryEntityKey(ref: EditorDocumentRef): string {
  return JSON.stringify(ref);
}

export class IndexedDbEditorRecovery {
  constructor(readonly namespace: string) {}

  async load(ref: EditorDocumentRef): Promise<EditorRecoveryRecord | null> {
    const database = await openDatabase();
    if (!database) return null;
    await this.expire(database);
    const key = storageKey(this.namespace, ref);
    const record = await requestResult<unknown>(
      database.transaction(STORE, "readonly").objectStore(STORE).get(key),
    );
    if (isRecoveryRecord(record, this.namespace, ref)) return record;
    if (record !== undefined) {
      await transactionComplete(database, "readwrite", (store) => store.delete(key));
    }
    return null;
  }

  async save(
    ref: EditorDocumentRef,
    baseSnapshot: EditorDocumentSnapshot,
    draft: EditorRecoveryDraft,
    editVersion: number,
  ): Promise<void> {
    const database = await openDatabase();
    if (!database) return;
    const record: EditorRecoveryRecord = {
      version: 1,
      namespace: this.namespace,
      entityKey: editorRecoveryEntityKey(ref),
      ref,
      baseRevision: baseSnapshot.revision,
      baseSnapshot,
      draft,
      editVersion,
      timestamp: Date.now(),
    };
    await transactionComplete(database, "readwrite", (store) => {
      store.put(record, storageKey(this.namespace, ref));
    });
  }

  async clear(ref: EditorDocumentRef): Promise<void> {
    const database = await openDatabase();
    if (!database) return;
    await transactionComplete(database, "readwrite", (store) => {
      store.delete(storageKey(this.namespace, ref));
    });
  }

  private async expire(database: IDBDatabase): Promise<void> {
    const records = await requestResult<EditorRecoveryRecord[]>(
      database.transaction(STORE, "readonly").objectStore(STORE).getAll(),
    );
    const cutoff = Date.now() - MAX_AGE_MS;
    const stale = records.filter((record) => record.timestamp < cutoff);
    if (stale.length === 0) return;
    await transactionComplete(database, "readwrite", (store) => {
      for (const record of stale) {
        store.delete(`${record.namespace}:${record.entityKey}`);
      }
    });
  }
}

function storageKey(namespace: string, ref: EditorDocumentRef): string {
  return `${namespace}:${editorRecoveryEntityKey(ref)}`;
}

function isRecoveryRecord(
  value: unknown,
  namespace: string,
  ref: EditorDocumentRef,
): value is EditorRecoveryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<EditorRecoveryRecord>;
  const base = record.baseSnapshot;
  const draft = record.draft;
  const refKey = editorRecoveryEntityKey(ref);
  return record.version === 1
    && record.namespace === namespace
    && record.entityKey === refKey
    && editorRecoveryEntityKey(record.ref as EditorDocumentRef) === refKey
    && typeof record.baseRevision === "string"
    && Boolean(base && typeof base === "object" && base.revision === record.baseRevision)
    && Boolean(base && editorRecoveryEntityKey(base.ref) === refKey)
    && Boolean(
      draft
      && typeof draft === "object"
      && draft.metadata
      && typeof draft.metadata === "object"
      && !Array.isArray(draft.metadata)
      && (draft.body === undefined || typeof draft.body === "string"),
    )
    && typeof record.editVersion === "number"
    && typeof record.timestamp === "number";
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open recovery database"));
  });
  void databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionComplete(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    operation(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}
