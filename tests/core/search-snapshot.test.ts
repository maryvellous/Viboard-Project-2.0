import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDeskService, type SearchItem } from "@desk/core";
import {
  InMemoryStorageProvider,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";

describe("search snapshot", () => {
  beforeEach(() => {
    resetDeskRuntime();
    setStorage(new InMemoryStorageProvider());
    setDataRootResolver(async () => "~/DeskMD");
  });

  afterEach(() => resetDeskRuntime());

  it("collects searchable records from every workspace through DeskService", async () => {
    const service = getDeskService();
    const first = await service.createWorkspace({ id: "first", name: "First Workspace" });
    const second = await service.createWorkspace({ id: "second", name: "Second Workspace" });
    const project = await service.createProject({
      workspaceId: first.id,
      name: "Launch",
      description: "Public release",
    });
    await service.updateProject(project.id, { overview: "# Orientation\n\nPrivate beta findings" }, first.id);
    await service.createTask({
      workspaceId: first.id,
      projectId: project.id,
      title: "Ship release",
      content: "Close the remaining gaps",
    });
    await service.createDoc({
      workspaceId: second.id,
      projectId: "_workspace",
      title: "Second notes",
      content: "Cross-workspace context",
    });

    const getSearchItems = (
      service as unknown as { getSearchItems?: () => Promise<SearchItem[]> }
    ).getSearchItems;
    expect(getSearchItems).toBeTypeOf("function");
    if (!getSearchItems) return;

    const items = await getSearchItems();
    expect(items.map((item) => [item.type, item.title, item.workspaceName])).toEqual([
      ["project", "Launch", "First Workspace"],
      ["task", "Ship release", "First Workspace"],
      ["doc", "Second notes", "Second Workspace"],
    ]);
    expect(items[0]?.content).toBe("Public release Orientation Private beta findings");
  });
});
