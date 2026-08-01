import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProjectCurrentTasks,
  buildProjectTimeline,
  getDeskService,
  getScopedEntityKey,
  type DeskService,
} from "@desk/core";
import type { Doc, Meeting, Project, Task } from "@desk/core/types";
import {
  getStorage,
  InMemoryStorageProvider,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";

describe("project insights", () => {
  let service: DeskService;

  beforeEach(async () => {
    resetDeskRuntime();
    setStorage(new InMemoryStorageProvider());
    setDataRootResolver(async () => "~/DeskMD");
    service = getDeskService();
    await service.createWorkspace({ id: "work", name: "Work" });
  });

  afterEach(() => resetDeskRuntime());

  it("manages completion timestamps without backfilling legacy done tasks", async () => {
    const project = await service.createProject({ workspaceId: "work", name: "Project" });
    const task = await service.createTask({ workspaceId: "work", projectId: project.id, title: "Task" });

    const done = await service.updateTask(task.id, { status: "done" }, "work", project.id);
    expect(done?.completed).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const completed = done?.completed;

    const edited = await service.updateTask(task.id, { content: "Edited" }, "work", project.id);
    expect(edited?.completed).toBe(completed);

    const reopened = await service.updateTask(task.id, { status: "todo" }, "work", project.id);
    expect(reopened?.completed).toBeUndefined();

    await getStorage().writeTextFile(
      task.filePath,
      "---\ntitle: Legacy\nstatus: done\ncreated: 2020-01-01\ncustom: keep-me\n---\n\nBody\n",
    );
    const legacy = await service.updateTask(task.id, { content: "Updated body" }, "work", project.id);
    expect(legacy?.completed).toBeUndefined();
    expect(await getStorage().readTextFile(task.filePath)).toContain("custom: keep-me");
  });

  it("builds truthful schedule and history events", async () => {
    const project = await service.createProject({ workspaceId: "work", name: "Timeline" });
    const overdue = await service.createTask({
      workspaceId: "work",
      projectId: project.id,
      title: "Overdue",
      due: "2099-01-02",
    });
    const future = await service.createTask({
      workspaceId: "work",
      projectId: project.id,
      title: "Future",
      due: "2099-01-12",
    });
    const done = await service.createTask({ workspaceId: "work", projectId: project.id, title: "Done" });
    await service.updateTask(done.id, { status: "done" }, "work", project.id);
    await service.createMeeting({
      workspaceId: "work",
      projectId: project.id,
      title: "Past meeting",
      date: "2099-01-05",
    });
    await service.createMeeting({
      workspaceId: "work",
      projectId: project.id,
      title: "Future meeting",
      date: "2099-01-15",
    });
    const doc = await service.createDoc({ workspaceId: "work", projectId: project.id, title: "Document" });
    await service.updateDoc(doc, { content: "Changed" });

    const home = await service.getProjectHome("work", project.id, { today: "2099-01-10" });
    expect(home?.timeline.schedule.map((event) => event.title)).toEqual([
      "Overdue",
      "Future",
      "Future meeting",
    ]);
    expect(home?.timeline.schedule[0]).toMatchObject({ overdue: true, entityId: overdue.id });
    expect(home?.timeline.history.some((event) => event.kind === "task-completed" && event.entityId === done.id)).toBe(true);
    expect(home?.timeline.history.some((event) => event.kind === "doc-updated" && event.entityId === doc.id)).toBe(true);
    expect(home?.timeline.history.some((event) => event.title === "Past meeting")).toBe(true);
    expect(home?.timeline.history.some((event) => event.kind === "task-due" && event.entityId === future.id)).toBe(false);
  });

  it("returns compact summaries and deterministically ordered current work", async () => {
    const project = await service.createProject({
      workspaceId: "work",
      name: "Context",
      description: "Durable context",
    });
    await service.updateProject(project.id, { overview: "# Very private and potentially large" }, "work");
    const todo = await service.createTask({ workspaceId: "work", projectId: project.id, title: "Todo" });
    const doing = await service.createTask({ workspaceId: "work", projectId: project.id, title: "Doing" });
    await service.updateTask(doing.id, { status: "doing" }, "work", project.id);
    await service.toggleTaskHighlight("work", project.id, getScopedEntityKey(todo));
    const doc = await service.createDoc({ workspaceId: "work", projectId: project.id, title: "Fresh document" });
    await service.updateDoc(doc, { content: "Meaningful update" });

    const summaries = await service.getProjectSummaries("work", { today: "2099-01-01" });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      name: "Context",
      description: "Durable context",
      taskCount: 2,
      tasksByStatus: { doing: 1, todo: 1 },
      docCount: 1,
    });
    expect(summaries[0].lastActivityAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(summaries[0]).not.toHaveProperty("overview");

    const home = await service.getProjectHome("work", project.id, { today: "2099-01-01" });
    expect(home?.currentTasks.map((task) => task.title)).toEqual(["Todo", "Doing"]);
    expect(home?.currentTasks[0].highlighted).toBe(true);
  });

  it("uses precedence and deterministic tie-breakers without mistaking due dates for history", () => {
    const project = {
      id: "project",
      workspaceId: "work",
      name: "Project",
      status: "active",
      created: "2026-01-01",
    } satisfies Project;
    const task = ({ id, title, ...overrides }: Partial<Task> & Pick<Task, "id" | "title">): Task => ({
      id,
      title,
      workspaceId: "work",
      projectId: "project",
      filePath: `/tasks/${id}.md`,
      status: "todo",
      content: "",
      ...overrides,
    });
    const tasks = [
      task({ id: "completed", title: "Completed", created: "2026-01-02", completed: "2026-01-04", status: "done" }),
      task({ id: "due-only", title: "Due only", due: "2026-01-08" }),
    ];
    const docs = [{
      id: "doc",
      title: "Document",
      workspaceId: "work",
      projectId: "project",
      filePath: "/doc.md",
      content: "",
      preview: "",
      created: "2026-01-02",
      updated: "2026-01-05T10:00:00.000Z",
    }] satisfies Doc[];

    const timeline = buildProjectTimeline(project, tasks, docs, [] satisfies Meeting[], "2026-01-06");
    expect(timeline.history.filter((event) => event.entityId === "completed").map((event) => event.kind)).toEqual(["task-completed"]);
    expect(timeline.history.filter((event) => event.entityId === "doc").map((event) => event.kind)).toEqual(["doc-updated"]);
    expect(timeline.history.some((event) => event.entityId === "due-only")).toBe(false);
    expect(timeline.schedule.map((event) => event.entityId)).toEqual(["due-only"]);
  });

  it("orders current work by focus, status, due date, priority, activity, and title", () => {
    const task = ({ id, title, ...overrides }: Partial<Task> & Pick<Task, "id" | "title">): Task => ({
      id,
      title,
      workspaceId: "work",
      projectId: "project",
      filePath: `/tasks/${id}.md`,
      status: "todo",
      content: "",
      ...overrides,
    });
    const tasks = [
      task({ id: "todo-later", title: "Todo later", due: "2026-04-02", priority: "high" }),
      task({ id: "waiting", title: "Waiting", status: "waiting" }),
      task({ id: "doing", title: "Doing", status: "doing" }),
      task({ id: "todo-low", title: "Todo low", due: "2026-04-01", priority: "low" }),
      task({ id: "todo-high", title: "Todo high", due: "2026-04-01", priority: "high" }),
    ];

    expect(buildProjectCurrentTasks(tasks, [getScopedEntityKey(tasks[1])]).map((item) => item.id)).toEqual([
      "waiting",
      "doing",
      "todo-high",
      "todo-low",
      "todo-later",
    ]);
  });
});
