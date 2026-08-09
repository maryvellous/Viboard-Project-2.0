import { describe, expect, it } from "vitest";
import { buildSearchSnippet, getSearchShortcutLabel } from "../../packages/app/src/lib/search-presentation";
import type { SearchResult } from "@desk/core";

describe("search result presentation", () => {
  it("clips a content match into a bounded highlighted excerpt", () => {
    const content = `${"before ".repeat(20)}important phrase${" after".repeat(20)}`;
    const start = content.indexOf("important phrase");
    const result: SearchResult = {
      item: {
        id: "doc",
        type: "doc",
        title: "Long document",
        content,
        workspaceId: "work",
        projectId: "project",
      },
      score: 0,
      matchKind: "content",
      matches: [{ key: "content", indices: [[start, start + "important phrase".length - 1]] }],
    };

    const snippet = buildSearchSnippet(result, 80);

    expect(snippet?.text.length).toBeLessThanOrEqual(80);
    expect(snippet?.text.startsWith("…")).toBe(true);
    expect(snippet?.text.endsWith("…")).toBe(true);
    expect(snippet?.segments.filter((segment) => segment.highlighted)).toEqual([
      { text: "important phrase", highlighted: true },
    ]);
  });

  it("returns no excerpt when the primary match is not content", () => {
    const result: SearchResult = {
      item: {
        id: "doc",
        type: "doc",
        title: "Launch",
        content: "Body",
        workspaceId: "work",
        projectId: "project",
      },
      score: 0,
      matchKind: "title",
      matches: [{ key: "title", indices: [[0, 5]] }],
    };

    expect(buildSearchSnippet(result)).toBeNull();
  });

  it("uses the native primary-modifier label", () => {
    expect(getSearchShortcutLabel(true)).toBe("⌘K");
    expect(getSearchShortcutLabel(false)).toBe("Ctrl K");
  });
});
