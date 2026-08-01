import {
  buildProjectCurrentTasks,
  buildProjectTimeline,
  type ProjectHomeData,
  type ProjectSummary,
} from "@desk/core";
import type { Doc, Meeting, Project, Task, TaskStatus } from "@desk/core/types";

const emptyTaskCounts = (): Record<TaskStatus, number> => ({
  backlog: 0,
  todo: 0,
  doing: 0,
  waiting: 0,
  done: 0,
});

/** True when a remote server predates one of the compact project RPC methods. */
export function isUnsupportedDeskOperation(error: unknown, operation: string): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(`Unknown desk op: ${operation}`)
    || error.message.includes(`desk RPC ${operation} failed (404)`);
}

/** Temporary compatibility shape for a newer client connected to an older server. */
export function legacyProjectsToSummaries(projects: Project[]): ProjectSummary[] {
  return projects.map((project) => {
    const tasksByStatus = project.tasksByStatus ?? emptyTaskCounts();
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      status: project.status,
      description: project.description,
      created: project.created,
      taskCount: project.taskCount ?? Object.values(tasksByStatus).reduce((sum, count) => sum + count, 0),
      tasksByStatus,
      docCount: project.docCount ?? 0,
      meetingCount: project.meetingCount ?? 0,
      lastActivityAt: project.created,
    };
  });
}

export function composeLegacyProjectHome(
  project: Project,
  tasks: Task[],
  docs: Doc[],
  meetings: Meeting[],
  highlightIds: Iterable<string>,
  today: string,
): ProjectHomeData {
  const timeline = buildProjectTimeline(project, tasks, docs, meetings, today);
  const tasksByStatus = emptyTaskCounts();
  for (const task of tasks) tasksByStatus[task.status]++;
  return {
    project: {
      ...project,
      taskCount: tasks.length,
      tasksByStatus,
      docCount: docs.length,
      meetingCount: meetings.length,
    },
    currentTasks: buildProjectCurrentTasks(tasks, highlightIds),
    timeline,
    lastActivityAt: timeline.history[0]?.at,
  };
}
