import type { SearchResult } from "@desk/core";
import { getKeyboardShortcutLabel } from "./keyboard-shortcuts";

export interface HighlightedTextSegment {
  text: string;
  highlighted: boolean;
}

export interface SearchSnippet {
  text: string;
  segments: HighlightedTextSegment[];
}

export function getSearchShortcutLabel(isMac: boolean): string {
  return getKeyboardShortcutLabel("palette", isMac);
}

export function buildSearchSnippet(
  result: SearchResult,
  maxLength: number = 140,
): SearchSnippet | null {
  if (result.matchKind !== "content") return null;
  const contentMatch = result.matches?.find((match) => match.key === "content");
  if (!contentMatch || contentMatch.indices.length === 0 || maxLength < 3) return null;

  const content = result.item.content;
  const firstMatchStart = contentMatch.indices[0][0];
  let contentBudget = Math.min(maxLength, content.length);
  let sliceStart = Math.max(
    0,
    Math.min(firstMatchStart - Math.floor(contentBudget / 2), content.length - contentBudget),
  );
  let sliceEnd = sliceStart + contentBudget;
  let clippedStart = sliceStart > 0;
  let clippedEnd = sliceEnd < content.length;

  contentBudget = maxLength - Number(clippedStart) - Number(clippedEnd);
  sliceStart = Math.max(
    0,
    Math.min(firstMatchStart - Math.floor(contentBudget / 2), content.length - contentBudget),
  );
  sliceEnd = Math.min(content.length, sliceStart + contentBudget);
  clippedStart = sliceStart > 0;
  clippedEnd = sliceEnd < content.length;

  const prefix = clippedStart ? "…" : "";
  const suffix = clippedEnd ? "…" : "";
  const excerpt = content.slice(sliceStart, sliceEnd);
  const ranges = contentMatch.indices
    .map(([start, end]) => [
      Math.max(0, start - sliceStart) + prefix.length,
      Math.min(excerpt.length, end - sliceStart + 1) + prefix.length,
    ] as const)
    .filter(([start, end]) => start < end && end > prefix.length)
    .map(([start, end]) => [
      Math.max(prefix.length, start),
      Math.min(prefix.length + excerpt.length, end),
    ] as const);
  const text = `${prefix}${excerpt}${suffix}`;

  return { text, segments: splitHighlightedText(text, ranges) };
}

export function splitHighlightedText(
  text: string,
  ranges: ReadonlyArray<readonly [number, number]>,
): HighlightedTextSegment[] {
  const merged = [...ranges]
    .sort((a, b) => a[0] - b[0])
    .reduce<Array<[number, number]>>((result, [start, end]) => {
      const boundedStart = Math.max(0, Math.min(text.length, start));
      const boundedEnd = Math.max(boundedStart, Math.min(text.length, end));
      if (boundedStart === boundedEnd) return result;
      const previous = result[result.length - 1];
      if (previous && boundedStart <= previous[1]) {
        previous[1] = Math.max(previous[1], boundedEnd);
      } else {
        result.push([boundedStart, boundedEnd]);
      }
      return result;
    }, []);

  const segments: HighlightedTextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (cursor < start) segments.push({ text: text.slice(cursor, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });
  return segments;
}
