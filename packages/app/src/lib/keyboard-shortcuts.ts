export type KeyboardShortcutId =
  | "palette"
  | "save"
  | "close-tab"
  | "previous-tab"
  | "next-tab";

interface KeyboardShortcutDefinition {
  key: string;
  code?: string;
  shiftKey?: boolean;
}

const SHORTCUTS: Record<KeyboardShortcutId, KeyboardShortcutDefinition> = {
  palette: { key: "k" },
  save: { key: "s" },
  "close-tab": { key: "w" },
  "previous-tab": { key: "[", code: "BracketLeft", shiftKey: true },
  "next-tab": { key: "]", code: "BracketRight", shiftKey: true },
};

export function matchesKeyboardShortcut(
  event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  id: KeyboardShortcutId,
): boolean {
  const shortcut = SHORTCUTS[id];
  return (event.metaKey || event.ctrlKey)
    && !event.altKey
    && event.shiftKey === Boolean(shortcut.shiftKey)
    && (shortcut.code
      ? event.code === shortcut.code
      : event.key.toLocaleLowerCase() === shortcut.key);
}

export function getKeyboardShortcutLabel(id: KeyboardShortcutId, isMac: boolean): string {
  const shortcut = SHORTCUTS[id];
  const modifiers = isMac
    ? `⌘${shortcut.shiftKey ? "⇧" : ""}`
    : `Ctrl${shortcut.shiftKey ? " Shift" : ""} `;
  return `${modifiers}${shortcut.key.toUpperCase()}`;
}
