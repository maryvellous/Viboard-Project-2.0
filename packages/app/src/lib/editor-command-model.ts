export interface TableSize {
  rows: number;
  cols: number;
}

export type TablePickerArrowKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

export const TABLE_PICKER_LIMIT = 8;
export const DEFAULT_TABLE_SIZE: TableSize = { rows: 3, cols: 3 };

export function moveTablePickerSelection(
  selection: TableSize,
  key: TablePickerArrowKey,
): TableSize {
  const rowDelta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const colDelta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;

  return {
    rows: Math.min(TABLE_PICKER_LIMIT, Math.max(1, selection.rows + rowDelta)),
    cols: Math.min(TABLE_PICKER_LIMIT, Math.max(1, selection.cols + colDelta)),
  };
}

export interface CodeBlockLanguage {
  value: string;
  label: string;
}

export const CODE_BLOCK_LANGUAGES: readonly CodeBlockLanguage[] = [
  { value: "", label: "Plain text" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "python", label: "Python" },
  { value: "swift", label: "Swift" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
];

const PLAIN_TEXT_SELECT_VALUE = "plain";
const LANGUAGE_SELECT_PREFIX = "language:";

export function encodeCodeBlockLanguage(language: string): string {
  return language
    ? `${LANGUAGE_SELECT_PREFIX}${language}`
    : PLAIN_TEXT_SELECT_VALUE;
}

export function decodeCodeBlockLanguage(value: string): string {
  return value.startsWith(LANGUAGE_SELECT_PREFIX)
    ? value.slice(LANGUAGE_SELECT_PREFIX.length)
    : "";
}

export function getCodeBlockLanguageOptions(
  currentLanguage: string | null | undefined,
): readonly CodeBlockLanguage[] {
  const current = currentLanguage?.trim() ?? "";
  if (!current || CODE_BLOCK_LANGUAGES.some(({ value }) => value === current)) {
    return CODE_BLOCK_LANGUAGES;
  }

  return [{ value: current, label: current }, ...CODE_BLOCK_LANGUAGES];
}
