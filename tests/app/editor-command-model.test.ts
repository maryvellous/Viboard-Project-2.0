import { describe, expect, it } from "vitest";
import {
  CODE_BLOCK_LANGUAGES,
  DEFAULT_TABLE_SIZE,
  decodeCodeBlockLanguage,
  encodeCodeBlockLanguage,
  getCodeBlockLanguageOptions,
  moveTablePickerSelection,
} from "../../packages/app/src/lib/editor-command-model";

describe("table size picker", () => {
  it("starts at the familiar 3 by 3 size", () => {
    expect(DEFAULT_TABLE_SIZE).toEqual({ rows: 3, cols: 3 });
  });

  it("moves one dimension at a time and clamps to the 8 by 8 grid", () => {
    expect(moveTablePickerSelection({ rows: 3, cols: 3 }, "ArrowRight")).toEqual({
      rows: 3,
      cols: 4,
    });
    expect(moveTablePickerSelection({ rows: 3, cols: 3 }, "ArrowDown")).toEqual({
      rows: 4,
      cols: 3,
    });
    expect(moveTablePickerSelection({ rows: 1, cols: 1 }, "ArrowLeft")).toEqual({
      rows: 1,
      cols: 1,
    });
    expect(moveTablePickerSelection({ rows: 8, cols: 8 }, "ArrowDown")).toEqual({
      rows: 8,
      cols: 8,
    });
  });
});

describe("code block languages", () => {
  it("includes the languages used by Desk documents", () => {
    expect(CODE_BLOCK_LANGUAGES.map(({ value }) => value)).toEqual([
      "",
      "shell",
      "sql",
      "javascript",
      "typescript",
      "json",
      "yaml",
      "python",
      "swift",
      "rust",
      "go",
    ]);
  });

  it("preserves an unknown fenced-code language as the current option", () => {
    expect(getCodeBlockLanguageOptions("terraform")).toEqual([
      { value: "terraform", label: "terraform" },
      ...CODE_BLOCK_LANGUAGES,
    ]);
  });

  it("does not duplicate a known language", () => {
    expect(getCodeBlockLanguageOptions("sql")).toEqual(CODE_BLOCK_LANGUAGES);
  });

  it("keeps custom languages distinct from the plain-text select value", () => {
    expect(encodeCodeBlockLanguage("")).not.toBe(
      encodeCodeBlockLanguage("__plain_text__"),
    );
    expect(
      decodeCodeBlockLanguage(encodeCodeBlockLanguage("__plain_text__")),
    ).toBe("__plain_text__");
    expect(decodeCodeBlockLanguage(encodeCodeBlockLanguage(""))).toBe("");
  });
});
