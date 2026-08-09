import { describe, expect, it, vi } from "vitest";
import { createSearchIndexController } from "../../packages/app/src/lib/search-index-controller";
import type { SearchItem } from "@desk/core";

const item: SearchItem = {
  id: "doc",
  type: "doc",
  title: "Document",
  content: "Body",
  workspaceId: "work",
  projectId: "project",
};

describe("search index controller", () => {
  it("deduplicates concurrent refreshes and publishes one ready revision", async () => {
    let resolveLoad: ((items: SearchItem[]) => void) | undefined;
    const load = vi.fn(() => new Promise<SearchItem[]>((resolve) => { resolveLoad = resolve; }));
    const replace = vi.fn();
    const controller = createSearchIndexController(load, replace);

    const first = controller.refresh();
    const second = controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ status: "building", revision: 0 });
    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad?.([item]);
    await Promise.all([first, second]);

    expect(replace).toHaveBeenCalledWith([item]);
    expect(controller.getSnapshot()).toEqual({ status: "ready", revision: 1, hasUsableIndex: true });
  });

  it("retains the last usable revision when a refresh fails", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce([item])
      .mockRejectedValueOnce(new Error("offline"));
    const controller = createSearchIndexController(load, vi.fn());

    await controller.refresh();
    await controller.refresh();

    expect(controller.getSnapshot()).toEqual({ status: "error", revision: 1, hasUsableIndex: true });
  });
});
