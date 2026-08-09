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
  it("coalesces refreshes during a build into one trailing refresh", async () => {
    const resolvers: Array<(items: SearchItem[]) => void> = [];
    const load = vi.fn(() => new Promise<SearchItem[]>((resolve) => { resolvers.push(resolve); }));
    const replace = vi.fn();
    const controller = createSearchIndexController(load, replace);

    const first = controller.refresh();
    const second = controller.refresh();
    const third = controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ status: "building", revision: 0 });
    expect(load).toHaveBeenCalledTimes(1);

    resolvers[0]([item]);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    resolvers[1]([{ ...item, title: "Newest document" }]);
    await Promise.all([first, second, third]);

    expect(replace).toHaveBeenLastCalledWith([{ ...item, title: "Newest document" }]);
    expect(controller.getSnapshot()).toEqual({ status: "ready", revision: 2, hasUsableIndex: true });
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

  it("clears usable data and discards an older in-flight result", async () => {
    let resolveLoad: ((items: SearchItem[]) => void) | undefined;
    const replace = vi.fn();
    const controller = createSearchIndexController(
      () => new Promise<SearchItem[]>((resolve) => { resolveLoad = resolve; }),
      replace,
    );

    const refresh = controller.refresh();
    controller.clear();
    resolveLoad?.([item]);
    await refresh;

    expect(replace).toHaveBeenLastCalledWith([]);
    expect(controller.getSnapshot()).toEqual({ status: "idle", revision: 1, hasUsableIndex: false });
  });
});
