import { describe, expect, it } from "vitest";
import type { Project } from "@desk/core/types";
import {
  isUnsupportedDeskOperation,
  legacyProjectsToSummaries,
} from "../../packages/app/src/lib/project-service-compat";

describe("project service compatibility", () => {
  it("recognizes only unsupported compact project operations", () => {
    expect(isUnsupportedDeskOperation(new Error("Unknown desk op: getProjectSummaries"), "getProjectSummaries")).toBe(true);
    expect(isUnsupportedDeskOperation(new Error("desk RPC getProjectHome failed (404)"), "getProjectHome")).toBe(true);
    expect(isUnsupportedDeskOperation(new Error("Request failed"), "getProjectHome")).toBe(false);
  });

  it("drops overview bodies when adapting legacy projects", () => {
    const project: Project = {
      id: "alpha",
      workspaceId: "work",
      name: "Alpha",
      status: "active",
      overview: "Large private overview",
      created: "2026-01-01",
      tasksByStatus: { backlog: 1, todo: 2, doing: 0, waiting: 0, done: 3 },
      docCount: 4,
      meetingCount: 5,
    };
    const [summary] = legacyProjectsToSummaries([project]);
    expect(summary).toMatchObject({ taskCount: 6, docCount: 4, meetingCount: 5 });
    expect(summary).not.toHaveProperty("overview");
  });
});
