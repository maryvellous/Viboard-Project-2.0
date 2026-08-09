import { describe, expect, it } from "vitest";
import { openSearchProject } from "../../packages/app/src/lib/search-navigation";

describe("search project navigation", () => {
  it("switches a foreign project workspace, activates Desk, and navigates", () => {
    let currentWorkspaceId = "personal";
    const events: string[] = [];

    const opened = openSearchProject(
      { id: "launch", workspaceId: "client" },
      {
        currentWorkspaceId,
        setCurrentWorkspaceId: (id) => { currentWorkspaceId = id; events.push(`workspace:${id}`); },
        getCurrentWorkspaceId: () => currentWorkspaceId,
        confirmUnsavedChanges: () => { events.push("confirm"); return true; },
        activateDesk: () => events.push("desk"),
        navigate: (path) => events.push(`navigate:${path}`),
      },
    );

    expect(opened).toBe(true);
    expect(events).toEqual(["workspace:client", "desk", "navigate:/projects?open=launch"]);
  });

  it("does not navigate when a foreign workspace switch is declined", () => {
    const events: string[] = [];
    const opened = openSearchProject(
      { id: "launch", workspaceId: "client" },
      {
        currentWorkspaceId: "personal",
        setCurrentWorkspaceId: () => events.push("workspace-attempt"),
        getCurrentWorkspaceId: () => "personal",
        confirmUnsavedChanges: () => true,
        activateDesk: () => events.push("desk"),
        navigate: () => events.push("navigate"),
      },
    );

    expect(opened).toBe(false);
    expect(events).toEqual(["workspace-attempt"]);
  });
});
