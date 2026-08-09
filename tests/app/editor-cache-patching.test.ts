import { describe, expect, it, vi } from "vitest";
import { mapQueryArray } from "../../packages/app/src/lib/query-client";

describe("editor cache patching", () => {
  it("does not treat a task detail object as a task list", () => {
    const detail = { id: "ship", content: "before" };
    const mapper = vi.fn((task: typeof detail) => ({ ...task, content: "after" }));

    const result = mapQueryArray(
      detail as unknown as Array<typeof detail>,
      mapper,
    );

    expect(result).toBe(detail);
    expect(mapper).not.toHaveBeenCalled();
  });
});
