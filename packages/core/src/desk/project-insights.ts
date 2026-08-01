import type {
  Doc,
  Meeting,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "../types";
import { compareDatesDesc } from "./parser";
import { getDocs, getDocsByProject } from "./content";
import { getMeetings, getMeetingsByProject } from "./meetings";
import { getProjectRecord, getProjectRecords } from "./projects";
import { getTasks, getTasksByProject } from "./tasks";
import { getScopedEntityKey } from "./entity-identity";
import { getHighlightedTasks } from "./view-state";

export interface ProjectInsightsOptions {
  /** Local calendar date supplied by the client, formatted as YYYY-MM-DD. */
  today: string;
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;
  taskCount: number;
  tasksByStatus: Record<TaskStatus, number>;
  docCount: number;
  meetingCount: number;
  lastActivityAt?: string;
}

export interface ProjectCurrentTask {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
  highlighted: boolean;
}

export type ProjectTimelineEventKind =
  | "project-created"
  | "task-created"
  | "task-completed"
  | "task-due"
  | "meeting"
  | "doc-created"
  | "doc-updated";

export interface ProjectTimelineEvent {
  id: string;
  kind: ProjectTimelineEventKind;
  at: string;
  title: string;
  workspaceId: string;
  projectId: string;
  entityType?: "task" | "doc" | "meeting";
  entityId?: string;
  overdue?: boolean;
}

export interface ProjectTimeline {
  schedule: ProjectTimelineEvent[];
  history: ProjectTimelineEvent[];
}

export interface ProjectHomeData {
  project: Project;
  currentTasks: ProjectCurrentTask[];
  timeline: ProjectTimeline;
  lastActivityAt?: string;
}

const emptyTaskCounts = (): Record<TaskStatus, number> => ({
  backlog: 0,
  todo: 0,
  doing: 0,
  waiting: 0,
  done: 0,
});

function eventId(kind: ProjectTimelineEventKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

function entityEvent(
  kind: ProjectTimelineEventKind,
  at: string,
  item: Pick<Task | Doc | Meeting, "id" | "title" | "workspaceId" | "projectId">,
  entityType: "task" | "doc" | "meeting",
  extra: Pick<ProjectTimelineEvent, "overdue"> = {},
): ProjectTimelineEvent {
  return {
    id: eventId(kind, item.id),
    kind,
    at,
    title: item.title,
    workspaceId: item.workspaceId,
    projectId: item.projectId,
    entityType,
    entityId: item.id,
    ...extra,
  };
}

function compareHistory(a: ProjectTimelineEvent, b: ProjectTimelineEvent): number {
  return compareDatesDesc(a.at, b.at) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
}

function compareSchedule(a: ProjectTimelineEvent, b: ProjectTimelineEvent): number {
  if (Boolean(a.overdue) !== Boolean(b.overdue)) return a.overdue ? -1 : 1;
  if (a.overdue && b.overdue) return b.at.localeCompare(a.at) || a.title.localeCompare(b.title);
  return a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
}

export function buildProjectTimeline(
  project: Pick<Project, "id" | "workspaceId" | "name" | "created">,
  tasks: Task[],
  docs: Doc[],
  meetings: Meeting[],
  today: string,
): ProjectTimeline {
  const schedule: ProjectTimelineEvent[] = [];
  const history: ProjectTimelineEvent[] = [];

  for (const task of tasks) {
    if (task.status !== "done" && task.due) {
      schedule.push(entityEvent("task-due", task.due, task, "task", { overdue: task.due < today }));
    }
    const activityAt = task.completed ?? task.created;
    if (activityAt && activityAt.slice(0, 10) <= today) {
      history.push(entityEvent(task.completed ? "task-completed" : "task-created", activityAt, task, "task"));
    }
  }

  for (const doc of docs) {
    const activityAt = doc.updated ?? doc.created;
    if (activityAt && activityAt.slice(0, 10) <= today) {
      history.push(entityEvent(doc.updated ? "doc-updated" : "doc-created", activityAt, doc, "doc"));
    }
  }

  for (const meeting of meetings) {
    if (!meeting.date) continue;
    const event = entityEvent("meeting", meeting.date, meeting, "meeting");
    if (meeting.date >= today) schedule.push(event);
    else history.push(event);
  }

  if (project.created && project.created.slice(0, 10) <= today) {
    history.push({
      id: eventId("project-created", project.id),
      kind: "project-created",
      at: project.created,
      title: project.name,
      workspaceId: project.workspaceId,
      projectId: project.id,
    });
  }

  schedule.sort(compareSchedule);
  history.sort(compareHistory);
  return { schedule, history };
}

const statusRank: Record<TaskStatus, number> = {
  doing: 0,
  waiting: 1,
  todo: 2,
  backlog: 3,
  done: 4,
};

const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function compareCurrentTasks(a: ProjectCurrentTask, b: ProjectCurrentTask): number {
  if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
  const status = statusRank[a.status] - statusRank[b.status];
  if (status !== 0) return status;
  const due = (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99");
  if (due !== 0) return due;
  const priority = (a.priority ? priorityRank[a.priority] : 3) - (b.priority ? priorityRank[b.priority] : 3);
  if (priority !== 0) return priority;
  return compareDatesDesc(a.updated ?? a.created, b.updated ?? b.created) || a.title.localeCompare(b.title);
}

export function buildProjectCurrentTasks(tasks: Task[], highlightIds: Iterable<string>): ProjectCurrentTask[] {
  const highlights = new Set(highlightIds);
  return tasks
    .filter((task) => task.status === "doing" || task.status === "waiting" || task.status === "todo")
    .map((task) => ({
      id: task.id,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due: task.due,
      created: task.created,
      updated: task.updated,
      highlighted: highlights.has(getScopedEntityKey(task)) || highlights.has(task.id),
    }))
    .sort(compareCurrentTasks);
}

function summarizeProject(
  project: Project,
  tasks: Task[],
  docs: Doc[],
  meetings: Meeting[],
  today: string,
  timeline = buildProjectTimeline(project, tasks, docs, meetings, today),
): ProjectSummary {
  const tasksByStatus = emptyTaskCounts();
  for (const task of tasks) tasksByStatus[task.status]++;
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    status: project.status,
    description: project.description,
    created: project.created,
    taskCount: tasks.length,
    tasksByStatus,
    docCount: docs.length,
    meetingCount: meetings.length,
    lastActivityAt: timeline.history[0]?.at,
  };
}

function groupByProject<T extends { projectId: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.projectId);
    if (group) group.push(item);
    else groups.set(item.projectId, [item]);
  }
  return groups;
}

export async function getProjectSummaries(
  workspaceId: string,
  options: ProjectInsightsOptions,
): Promise<ProjectSummary[]> {
  const [projects, tasks, docs, meetings] = await Promise.all([
    getProjectRecords(workspaceId),
    getTasks(workspaceId),
    getDocs(workspaceId),
    getMeetings(workspaceId),
  ]);
  const tasksByProject = groupByProject(tasks);
  const docsByProject = groupByProject(docs);
  const meetingsByProject = groupByProject(meetings);
  return projects.map((project) => summarizeProject(
    project,
    tasksByProject.get(project.id) ?? [],
    docsByProject.get(project.id) ?? [],
    meetingsByProject.get(project.id) ?? [],
    options.today,
  ));
}

export async function getProjectHome(
  workspaceId: string,
  projectId: string,
  options: ProjectInsightsOptions,
): Promise<ProjectHomeData | null> {
  const [project, tasks, docs, meetings, workspaceHighlights, projectHighlights] = await Promise.all([
    getProjectRecord(workspaceId, projectId),
    getTasksByProject(workspaceId, projectId),
    getDocsByProject(workspaceId, projectId),
    getMeetingsByProject(workspaceId, projectId),
    getHighlightedTasks(workspaceId, null),
    getHighlightedTasks(workspaceId, projectId),
  ]);
  if (!project) return null;

  const timeline = buildProjectTimeline(project, tasks, docs, meetings, options.today);
  const summary = summarizeProject(project, tasks, docs, meetings, options.today, timeline);
  return {
    project: {
      ...project,
      taskCount: summary.taskCount,
      tasksByStatus: summary.tasksByStatus,
      docCount: summary.docCount,
      meetingCount: summary.meetingCount,
    },
    currentTasks: buildProjectCurrentTasks(tasks, [...workspaceHighlights, ...projectHighlights]),
    timeline,
    lastActivityAt: summary.lastActivityAt,
  };
}
