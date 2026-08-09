/**
 * Editor-notifier seam.
 *
 * After a delete/move, the domain notifies open editor tabs so they can retain
 * or re-point their drafts. Writes are synchronized through versioned editor
 * queries, not through this path-only lifecycle seam. On a server there are no
 * editors, so the default is a no-op.
 *
 * Mirrors the storage/service registries (the set/get registry pattern).
 */
export interface EditorNotifier {
  isOpen(path: string): boolean;
  handlePathDeleted(path: string): void;
  handlePathChange(oldPath: string, newPath: string): void;
}

const NOOP: EditorNotifier = {
  isOpen: () => false,
  handlePathDeleted: () => {},
  handlePathChange: () => {},
};

let notifier: EditorNotifier = NOOP;

export function setEditorNotifier(n: EditorNotifier): void {
  notifier = n;
}

export function resetEditorNotifier(): void {
  notifier = NOOP;
}

export function getEditorNotifier(): EditorNotifier {
  return notifier;
}
