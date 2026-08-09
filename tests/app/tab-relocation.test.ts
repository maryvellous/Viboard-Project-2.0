import { afterEach, describe, expect, it } from "vitest";
import { getEntityTabId } from "../../packages/app/src/lib/tab-identity";
import { useTabStore, type TabItem } from "../../packages/app/src/stores/tabs";

const deskTab: TabItem = {
  id: "desk",
  type: "desk",
  title: "Desk",
  isPinned: true,
};

afterEach(() => {
  useTabStore.setState({
    tabs: [deskTab],
    activeTabId: "desk",
    pendingSaveAndClose: null,
    failedSaveAndClose: null,
  });
});

describe("open editor path relocation", () => {
  it("updates document identity and the active tab atomically", () => {
    const oldId = getEntityTabId("doc", {
      id: "Research/notes",
      workspaceId: "acme",
      projectId: "website",
    });
    useTabStore.setState({
      tabs: [
        deskTab,
        {
          id: oldId,
          type: "doc",
          entityId: "Research/notes",
          title: "Notes",
          workspaceId: "acme",
          projectId: "website",
          isDirty: false,
        },
      ],
      activeTabId: oldId,
    });

    useTabStore.getState().relocateEntityTab(oldId, {
      entityId: "Archive/notes",
      projectId: "_workspace",
    });

    const relocated = useTabStore.getState().tabs[1];
    expect(relocated).toMatchObject({
      type: "doc",
      entityId: "Archive/notes",
      workspaceId: "acme",
      projectId: "_workspace",
    });
    expect(useTabStore.getState().activeTabId).toBe(relocated.id);
    expect(relocated.id).not.toBe(oldId);
  });
});
