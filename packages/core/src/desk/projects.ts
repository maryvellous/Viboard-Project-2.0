/**
 * Projects library - File system operations for projects
 */
import type { Project, ProjectStatus, ProjectUpdate } from "../types";
import { parseMarkdown, serializeMarkdown, slugify, todayISO } from "./parser";
import {
  decodeProjectFrontmatter,
  decodeTaskFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { allocateUniqueName, removeDirectoryWithContents } from "./file-operations";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";

interface ProjectFrontmatter {
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;
}

/** Read project.md without walking the project's task/content directories. */
export async function getProjectRecord(
  workspaceId: string,
  projectId: string,
): Promise<Project | null> {
  const deskPath = await getDeskPath();
  const projectMdPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
    "project.md",
  );

  try {
    const content = await getStorage().readTextFile(projectMdPath);
    const { data: rawData, content: body } = parseMarkdown<Record<string, unknown>>(content);
    const decoded = decodeProjectFrontmatter(rawData, projectId);
    reportFrontmatterDiagnostics("project", projectMdPath, decoded.diagnostics);
    return {
      id: projectId,
      workspaceId,
      name: decoded.value.name,
      status: decoded.value.status,
      description: decoded.value.description,
      overview: body.trim() || undefined,
      created: decoded.value.created,
    };
  } catch (error) {
    console.warn(`Failed to read project ${projectId}:`, error);
    return null;
  }
}

/** Read all project.md records without their child collections. */
export async function getProjectRecords(workspaceId: string): Promise<Project[]> {
  const deskPath = await getDeskPath();
  const projectsPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
  );
  if (!(await getStorage().exists(projectsPath))) return [];

  const entries = await getStorage().readDir(projectsPath);
  const records = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory
          && !entry.name.startsWith(".")
          && entry.name !== SPECIAL_DIRS.UNASSIGNED,
      )
      .map((entry) => getProjectRecord(workspaceId, entry.name)),
  );
  return records.filter((project): project is Project => project !== null);
}

/**
 * Count tasks in a project directory
 */
async function countProjectTasks(projectPath: string): Promise<{
  total: number;
  byStatus: { backlog: number; todo: number; doing: number; waiting: number; done: number };
}> {
  const tasksPath = await joinPath(projectPath, PATH_SEGMENTS.TASKS);

  if (!(await getStorage().exists(tasksPath))) {
    return { total: 0, byStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 } };
  }

  const entries = await getStorage().readDir(tasksPath);
  const byStatus = { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 };

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(tasksPath, entry.name);
        const content = await getStorage().readTextFile(taskPath);
        const { data } = parseMarkdown<Record<string, unknown>>(content);
        const decoded = decodeTaskFrontmatter(data, entry.name, entry.name);
        reportFrontmatterDiagnostics("task", taskPath, decoded.diagnostics);
        byStatus[decoded.value.status]++;
      } catch {
        // Skip invalid task files
      }
    }
  }

  return {
    total: byStatus.backlog + byStatus.todo + byStatus.doing + byStatus.waiting + byStatus.done,
    byStatus,
  };
}

/**
 * Count markdown files in a directory.
 * Supports optional recursive traversal for nested docs folders.
 */
async function countMarkdownFiles(dirPath: string, recursive = false): Promise<number> {
  if (!(await getStorage().exists(dirPath))) {
    return 0;
  }

  const entries = await getStorage().readDir(dirPath);
  let count = 0;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      count++;
    } else if (recursive && entry.isDirectory && !entry.name.startsWith(".")) {
      const childPath = await joinPath(dirPath, entry.name);
      count += await countMarkdownFiles(childPath, true);
    }
  }

  return count;
}

/**
 * Get all projects for a workspace
 */
export async function getProjects(workspaceId: string): Promise<Project[]> {
  const deskPath = await getDeskPath();
  const records = await getProjectRecords(workspaceId);
  return Promise.all(records.map(async (project) => {
    const projectPath = await joinPath(
      deskPath,
      PATH_SEGMENTS.WORKSPACES,
      workspaceId,
      PATH_SEGMENTS.PROJECTS,
      project.id,
    );
    const [taskStats, docCount, meetingCount] = await Promise.all([
      countProjectTasks(projectPath),
      countMarkdownFiles(await joinPath(projectPath, PATH_SEGMENTS.DOCS), true),
      countMarkdownFiles(await joinPath(projectPath, PATH_SEGMENTS.MEETINGS)),
    ]);
    return {
      ...project,
      taskCount: taskStats.total,
      tasksByStatus: taskStats.byStatus,
      docCount,
      meetingCount,
    };
  }));
}

/**
 * Get a single project by ID
 */
export async function getProject(
  workspaceId: string,
  projectId: string
): Promise<Project | null> {
  const project = await getProjectRecord(workspaceId, projectId);
  if (!project) return null;
  const deskPath = await getDeskPath();
  const projectPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
  );
  const [taskStats, docCount, meetingCount] = await Promise.all([
    countProjectTasks(projectPath),
    countMarkdownFiles(await joinPath(projectPath, PATH_SEGMENTS.DOCS), true),
    countMarkdownFiles(await joinPath(projectPath, PATH_SEGMENTS.MEETINGS)),
  ]);
  return {
    ...project,
    taskCount: taskStats.total,
    tasksByStatus: taskStats.byStatus,
    docCount,
    meetingCount,
  };
}

/**
 * Create a new project
 */
export async function createProject(data: {
  workspaceId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
}): Promise<Project> {
  const preferredId = slugify(data.name) || "project";
  const deskPath = await getDeskPath();
  const projectsPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    data.workspaceId,
    PATH_SEGMENTS.PROJECTS,
  );
  const id = await allocateUniqueName(preferredId, async (candidate) =>
    getStorage().exists(await joinPath(projectsPath, candidate))
  );

  const project: Project = {
    id,
    workspaceId: data.workspaceId,
    name: data.name,
    status: data.status || "active",
    description: data.description,
    created: todayISO(),
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
  };

  const projectPath = await joinPath(projectsPath, id);

  // Create project directory structure
  await getStorage().mkdir(projectPath);
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.TASKS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.MEETINGS));

  // Create project.md — frontmatter holds metadata; the body is the overview.
  const frontmatter: ProjectFrontmatter = {
    name: project.name,
    status: project.status,
    description: project.description,
    created: project.created,
  };

  const fileContent = serializeMarkdown(frontmatter, "");
  await getStorage().writeTextFile(await joinPath(projectPath, "project.md"), fileContent);

  return project;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdate,
  workspaceId: string
): Promise<Project | null> {
  const deskPath = await getDeskPath();
  const projectMdPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
    "project.md"
  );

  if (!(await getStorage().exists(projectMdPath))) return null;

  const content = await getStorage().readTextFile(projectMdPath);
  const { data, content: body } = parseMarkdown<Record<string, unknown>>(content);

  const updatedData: Record<string, unknown> = {
    ...data,
    ...(updates.name && { name: updates.name }),
    ...(updates.status && { status: updates.status }),
    // null clears the field (→ undefined → dropped by serializeMarkdown); undefined leaves it.
    ...(updates.description !== undefined && { description: updates.description ?? undefined }),
  };

  // The body IS the overview. Rewrite it when the update carries one (null/"" clears it);
  // otherwise preserve the on-disk body untouched.
  const newBody = updates.overview !== undefined ? (updates.overview ?? "") : body;

  const fileContent = serializeMarkdown(updatedData, newBody);
  await getStorage().writeTextFile(projectMdPath, fileContent);
  const decoded = decodeProjectFrontmatter(updatedData, projectId).value;

  return {
    id: projectId,
    workspaceId,
    name: decoded.name,
    status: decoded.status,
    description: decoded.description,
    overview: newBody.trim() || undefined,
    created: decoded.created,
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
  };
}

/**
 * Delete a project (removes entire directory)
 */
export async function deleteProject(projectId: string, workspaceId: string): Promise<boolean> {
  const deskPath = await getDeskPath();
  const projectPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId);

  try {
    // Through the funnel: per-file delete events keep the Smart Index honest about the
    // project's records (a bare removeDir would leave every entry behind).
    return await removeDirectoryWithContents(projectPath);
  } catch {
    return false;
  }
}
