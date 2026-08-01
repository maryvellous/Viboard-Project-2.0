import type { ProjectSummary } from "@desk/core";
import { matchesSearch } from "./tree-count";

export type ProjectSortOrder = "recent" | "name";

export function filterAndSortProjects(
  projects: readonly ProjectSummary[],
  options: { query: string; status: string; sort: ProjectSortOrder },
): ProjectSummary[] {
  return projects
    .filter((project) => {
      if (options.status !== "all" && project.status !== options.status) return false;
      return matchesSearch(options.query, project.name, project.description);
    })
    .sort((a, b) => {
      if (options.sort === "name") return a.name.localeCompare(b.name);
      const activity = (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "");
      return activity || a.name.localeCompare(b.name);
    });
}
