import type { ProjectSummary } from "@desk/core";
import { matchesSearch } from "./tree-count";

export type ProjectSortOrder = "recent" | "name";

/**
 * Diaspro card variants for the project grid.
 *
 * The colour is a stable property of the project, not of its position or hover state:
 * it is derived from the project id, so a card keeps the same colour across renders,
 * filters, sorting and reloads (and never changes on hover).
 */
export const PROJECT_CARD_VARIANTS = [
  "default",
  "sand",
  "blue",
  "sage",
  "lavender",
  "plum",
  "terracotta",
] as const;

export type ProjectCardVariant = (typeof PROJECT_CARD_VARIANTS)[number];

export function projectCardVariant(projectId: string): ProjectCardVariant {
  let hash = 0;
  for (let index = 0; index < projectId.length; index++) {
    hash = (hash * 31 + projectId.charCodeAt(index)) % 100000;
  }
  return PROJECT_CARD_VARIANTS[hash % PROJECT_CARD_VARIANTS.length];
}

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
