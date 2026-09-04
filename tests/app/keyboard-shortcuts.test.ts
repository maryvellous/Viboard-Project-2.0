import { describe, expect, it } from "vitest";
import {
  getKeyboardShortcutLabel,
  matchesKeyboardShortcut,
} from "../../packages/app/src/lib/keyboard-shortcuts";

function keyboardEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  } as KeyboardEvent;
}

describe("keyboard shortcuts", () => {
  it("matches the platform primary modifier and rejects extra modifiers", () => {
    expect(matchesKeyboardShortcut(keyboardEvent({ key: "k", code: "KeyK", metaKey: true }), "palette")).toBe(true);
    expect(matchesKeyboardShortcut(keyboardEvent({ key: "k", code: "KeyK", ctrlKey: true }), "palette")).toBe(true);
    expect(matchesKeyboardShortcut(keyboardEvent({ key: "k", code: "KeyK", metaKey: true, shiftKey: true }), "palette")).toBe(false);
  });

  it("uses physical bracket keys for shifted tab navigation", () => {
    expect(matchesKeyboardShortcut(
      keyboardEvent({ key: "{", code: "BracketLeft", metaKey: true, shiftKey: true }),
      "previous-tab",
    )).toBe(true);
    expect(matchesKeyboardShortcut(
      keyboardEvent({ key: "}", code: "BracketRight", ctrlKey: true, shiftKey: true }),
      "next-tab",
    )).toBe(true);
  });

  it("formats macOS and non-macOS labels from the same definitions", () => {
    expect(getKeyboardShortcutLabel("palette", true)).toBe("⌘K");
    expect(getKeyboardShortcutLabel("save", false)).toBe("Ctrl S");
    expect(getKeyboardShortcutLabel("previous-tab", true)).toBe("⌘⇧[");
    expect(getKeyboardShortcutLabel("next-tab", false)).toBe("Ctrl Shift ]");
  });
});
