import { describe, expect, it } from "vitest";
import type { ProjectSummary } from "@desk/core";
import { filterAndSortProjects } from "../../packages/app/src/lib/project-browse";

function project(overrides: Partial<ProjectSummary> & Pick<ProjectSummary, "id" | "name">): ProjectSummary {
  return {
    workspaceId: "work",
    status: "active",
    created: "2026-01-01",
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
    ...overrides,
  };
}

describe("project browse", () => {
  const projects = [
    project({ id: "alpha", name: "Alpha", description: "Client portal", lastActivityAt: "2026-02-01" }),
    project({ id: "beta", name: "Beta", status: "paused", lastActivityAt: "2026-03-01" }),
    project({ id: "gamma", name: "Gamma", lastActivityAt: "2026-01-01" }),
  ];

  it("defaults to recent activity with a stable name tie-breaker", () => {
    expect(filterAndSortProjects(projects, { query: "", status: "all", sort: "recent" }).map((item) => item.id)).toEqual([
      "beta",
      "alpha",
      "gamma",
    ]);
  });

  it("supports alphabetical sorting and combined search/status filtering", () => {
    expect(filterAndSortProjects(projects, { query: "client", status: "active", sort: "name" }).map((item) => item.id)).toEqual(["alpha"]);
    expect(filterAndSortProjects(projects, { query: "", status: "active", sort: "name" }).map((item) => item.id)).toEqual(["alpha", "gamma"]);
  });
});
