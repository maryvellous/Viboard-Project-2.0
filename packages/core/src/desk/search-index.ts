/**
 * Search Index Service
 *
 * In-memory search index for fast lookups across all items.
 * Built on app startup; changes rebuild it wholesale (no incremental API).
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { Task, Doc, Meeting, Project } from "../types";
import { compareDatesDesc } from "./parser";
import { getWorkspaces } from "./workspaces";
import { getProjects } from "./projects";
import { getTasks } from "./tasks";
import { getDocs } from "./content";
import { getMeetings } from "./meetings";

// Unified search item type
export type SearchItemType = "task" | "doc" | "meeting" | "project";

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  content: string; // Preview/excerpt for search
  workspaceId: string;
  workspaceName?: string;
  projectId: string;
  projectName?: string;
  // Metadata for filtering/display
  status?: string;
  priority?: string;
  due?: string;
  created?: string;
  updated?: string;
  /** Provenance: 'ai' when an agent wrote the file (docs only; absent = the user). */
  author?: "ai";
  // Full path for navigation
  filePath?: string;
}

export interface SearchResult {
  item: SearchItem;
  score: number; // 0 = perfect match, 1 = no match
  matchKind?: SearchMatchKind;
  matches?: Array<{
    key: string;
    indices: Array<[number, number]>;
  }>;
}

export type SearchMatchKind = "title" | "project" | "workspace" | "content";

// Fuse.js configuration for fuzzy search
const FUSE_OPTIONS: IFuseOptions<SearchItem> = {
  keys: [
    { name: "title", weight: 0.6 },
    { name: "content", weight: 0.15 },
    { name: "projectName", weight: 0.15 },
    { name: "workspaceName", weight: 0.1 },
  ],
  threshold: 0.35, // 0 = exact, 1 = match anything
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true, // Search entire string, not just beginning
};

// Singleton state
let items: SearchItem[] = [];
let fuse: Fuse<SearchItem> | null = null;
let isInitialized = false;

/**
 * Initialize or rebuild the entire index
 */
export function rebuildIndex(newItems: SearchItem[]): void {
  items = newItems;
  fuse = new Fuse(items, FUSE_OPTIONS);
  isInitialized = true;
}

export function resetSearchIndex(): void {
  items = [];
  fuse = null;
  isInitialized = false;
}

/**
 * Search the index with fuzzy matching
 */
export function search(
  query: string,
  options?: {
    types?: SearchItemType[];
    workspaceId?: string;
    limit?: number;
  }
): SearchResult[] {
  if (!fuse || !isInitialized) {
    console.warn("[search-index] Index not initialized");
    return [];
  }

  if (!query.trim()) {
    // Return recent items if no query
    return getRecentItems(options?.limit ?? 10, options?.types, options?.workspaceId);
  }

  let results = fuse.search(query.trim());

  // Apply filters
  if (options?.types && options.types.length > 0) {
    results = results.filter((r) => options.types!.includes(r.item.type));
  }

  if (options?.workspaceId) {
    results = results.filter((r) => r.item.workspaceId === options.workspaceId);
  }

  let mapped = results.map((r) => ({
    item: r.item,
    score: r.score ?? 0,
    matchKind: getPrimaryMatchKind(r.matches),
    matches: r.matches?.map((m) => ({
      key: m.key ?? "",
      indices: m.indices as Array<[number, number]>,
    })),
  }));

  mapped.sort((a, b) => compareSearchResults(a, b, query));
  if (options?.limit) mapped = mapped.slice(0, options.limit);
  return mapped;
}

/**
 * Get recent items (by created date)
 */
export function getRecentItems(
  limit: number = 10,
  types?: SearchItemType[],
  workspaceId?: string
): SearchResult[] {
  let filtered = items;

  if (types && types.length > 0) {
    filtered = filtered.filter((i) => types.includes(i.type));
  }

  if (workspaceId) {
    filtered = filtered.filter((i) => i.workspaceId === workspaceId);
  }

  // Sort by the last known content activity (undated last).
  const sorted = [...filtered].sort((a, b) => {
    const byActivity = compareDatesDesc(a.updated ?? a.created, b.updated ?? b.created);
    if (byActivity !== 0) return byActivity;
    const byTitle = compareStableText(a.title, b.title);
    return byTitle !== 0 ? byTitle : compareStableText(stableSearchItemKey(a), stableSearchItemKey(b));
  });

  return sorted.slice(0, limit).map((item) => ({
    item,
    score: 0,
  }));
}

/**
 * Check if index is ready
 */
export function isIndexReady(): boolean {
  return isInitialized;
}

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getPrimaryMatchKind(
  matches: readonly { key?: string }[] | undefined
): SearchMatchKind | undefined {
  const keys = new Set(matches?.map((match) => match.key));
  if (keys.has("title")) return "title";
  if (keys.has("projectName")) return "project";
  if (keys.has("workspaceName")) return "workspace";
  if (keys.has("content")) return "content";
  return undefined;
}

function getMatchRank(result: SearchResult, query: string): number {
  const title = normalizeSearchText(result.item.title);
  const normalizedQuery = normalizeSearchText(query);
  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  if (result.matchKind === "title") return 3;
  if (result.matchKind === "project" || result.matchKind === "workspace") return 4;
  return 5;
}

function compareSearchResults(a: SearchResult, b: SearchResult, query: string): number {
  const byMatch = getMatchRank(a, query) - getMatchRank(b, query);
  if (byMatch !== 0) return byMatch;
  if (a.score !== b.score) return a.score - b.score;
  const byActivity = compareDatesDesc(
    a.item.updated ?? a.item.created,
    b.item.updated ?? b.item.created
  );
  if (byActivity !== 0) return byActivity;
  const byTitle = compareStableText(a.item.title, b.item.title);
  return byTitle !== 0
    ? byTitle
    : compareStableText(stableSearchItemKey(a.item), stableSearchItemKey(b.item));
}

function stableSearchItemKey(item: SearchItem): string {
  return [item.workspaceId, item.projectId, item.type, item.id].join("\0");
}

function compareStableText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Convert Markdown into compact text that can be searched and excerpted. */
export function markdownToSearchText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^- \[[ xX]\]\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/(\*\*|__|~~)(.*?)\1/g, "$2")
    .replace(/([*_])(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find a specific item by type and id.
 * Used for resolving internal note links (desk:// URIs).
 */
export function findByTypeAndId(
  type: SearchItemType,
  id: string,
  scope?: { workspaceId: string; projectId: string },
): SearchItem | null {
  if (!isInitialized) return null;
  const matches = items.filter((i) => i.type === type && i.id === id);
  if (scope) {
    return matches.find(
      (i) => i.workspaceId === scope.workspaceId && i.projectId === scope.projectId,
    ) ?? null;
  }
  // Legacy links contain no owner. Resolve only when the old ID is unambiguous.
  return matches.length === 1 ? matches[0] : null;
}

// Helper functions to convert domain objects to SearchItems

export function taskToSearchItem(
  task: Task,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: task.id,
    type: "task",
    title: task.title,
    content: markdownToSearchText(task.content ?? ""),
    workspaceId: task.workspaceId,
    workspaceName,
    projectId: task.projectId,
    projectName,
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
    updated: task.updated,
    filePath: task.filePath,
  };
}

export function docToSearchItem(
  doc: Doc,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: doc.id,
    type: "doc",
    title: doc.title,
    content: markdownToSearchText(doc.content ?? ""),
    workspaceId: doc.workspaceId,
    workspaceName,
    projectId: doc.projectId,
    projectName,
    created: doc.created,
    updated: doc.updated,
    author: doc.author,
    filePath: doc.filePath,
  };
}

export function meetingToSearchItem(
  meeting: Meeting,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: meeting.id,
    type: "meeting",
    title: meeting.title,
    content: markdownToSearchText(meeting.content ?? ""),
    workspaceId: meeting.workspaceId,
    workspaceName,
    projectId: meeting.projectId,
    projectName,
    created: meeting.created,
    updated: meeting.updated,
    filePath: meeting.filePath,
  };
}

export function projectToSearchItem(
  project: Project,
  workspaceName?: string
): SearchItem {
  return {
    id: project.id,
    type: "project",
    title: project.name,
    content: markdownToSearchText(
      [project.description, project.overview].filter(Boolean).join("\n\n")
    ),
    workspaceId: project.workspaceId,
    workspaceName,
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    created: project.created,
  };
}

/**
 * Read one complete cross-workspace snapshot for the UI search index.
 * Through DeskService this stays one RPC in hosted mode.
 */
export async function getSearchItems(): Promise<SearchItem[]> {
  const workspaces = await getWorkspaces();
  const perWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const [projects, tasks, docs, meetings] = await Promise.all([
        getProjects(workspace.id),
        getTasks(workspace.id),
        getDocs(workspace.id),
        getMeetings(workspace.id),
      ]);
      const projectNames = new Map(projects.map((project) => [project.id, project.name]));

      return [
        ...projects.map((project) => projectToSearchItem(project, workspace.name)),
        ...tasks.map((task) =>
          taskToSearchItem(task, workspace.name, projectNames.get(task.projectId))
        ),
        ...docs.map((doc) =>
          docToSearchItem(doc, workspace.name, projectNames.get(doc.projectId))
        ),
        ...meetings.map((meeting) =>
          meetingToSearchItem(meeting, workspace.name, projectNames.get(meeting.projectId))
        ),
      ];
    })
  );

  return perWorkspace.flat();
}
