import { beforeEach, describe, expect, it } from "vitest";
import {
  getRecentItems,
  rebuildIndex,
  resetSearchIndex,
  search,
  taskToSearchItem,
} from "@desk/core";
import type { Task } from "@desk/core/types";

describe("search index quality", () => {
  beforeEach(() => resetSearchIndex());

  it("finds body text beyond the old 200-character preview", () => {
    const task: Task = {
      id: "2026-08-09-long-task",
      workspaceId: "client-work",
      projectId: "website",
      filePath: "/desk/workspaces/client-work/website/tasks/2026-08-09-long-task.md",
      title: "Review launch notes",
      status: "todo",
      created: "2026-08-09",
      content: `${"intro ".repeat(50)}needle-after-preview`,
    };

    rebuildIndex([taskToSearchItem(task, "Client Work", "Website")]);

    expect(search("needle-after-preview")).toHaveLength(1);
  });

  it("indexes Markdown bodies as readable plain text", () => {
    const task: Task = {
      id: "2026-08-09-markdown",
      workspaceId: "client-work",
      projectId: "website",
      filePath: "/desk/workspaces/client-work/website/tasks/2026-08-09-markdown.md",
      title: "Markdown task",
      status: "todo",
      content: "# Launch plan\n\n- Review **accessibility** with [Alex](https://example.com).",
    };

    expect(taskToSearchItem(task).content).toBe(
      "Launch plan Review accessibility with Alex.",
    );
  });

  it("finds records by workspace name", () => {
    const task: Task = {
      id: "2026-08-09-budget",
      workspaceId: "acme-consulting",
      projectId: "finance",
      filePath: "/desk/workspaces/acme-consulting/finance/tasks/2026-08-09-budget.md",
      title: "Review budget",
      status: "todo",
      created: "2026-08-09",
      content: "Quarterly numbers",
    };

    rebuildIndex([taskToSearchItem(task, "Acme Consulting", "Finance")]);

    expect(search("Acme Consulting")[0]?.item.id).toBe(task.id);
  });

  it("orders empty-query results by updated time before created time", () => {
    rebuildIndex([
      {
        id: "older-created-but-edited",
        type: "doc",
        title: "Edited recently",
        content: "",
        workspaceId: "personal",
        projectId: "notes",
        created: "2026-07-01",
        updated: "2026-08-09T12:00:00.000Z",
      },
      {
        id: "newer-created",
        type: "doc",
        title: "Created recently",
        content: "",
        workspaceId: "personal",
        projectId: "notes",
        created: "2026-08-08",
        updated: "2026-08-08T12:00:00.000Z",
      },
    ]);

    expect(getRecentItems().map((result) => result.item.id)).toEqual([
      "older-created-but-edited",
      "newer-created",
    ]);
  });

  it("ranks title quality ahead of context and body matches", () => {
    rebuildIndex([
      { id: "body", type: "doc", title: "Notes", content: "launch", workspaceId: "w", projectId: "p" },
      { id: "context", type: "doc", title: "Brief", content: "", workspaceId: "w", projectId: "p", projectName: "Launch" },
      { id: "fuzzy", type: "doc", title: "Lauch plan", content: "", workspaceId: "w", projectId: "p" },
      { id: "contains", type: "doc", title: "Website launch", content: "", workspaceId: "w", projectId: "p" },
      { id: "prefix", type: "doc", title: "Launch checklist", content: "", workspaceId: "w", projectId: "p" },
      { id: "exact", type: "doc", title: "Launch", content: "", workspaceId: "w", projectId: "p" },
    ]);

    const results = search("launch");
    expect(results.map((result) => result.item.id)).toEqual([
      "exact",
      "prefix",
      "contains",
      "fuzzy",
      "context",
      "body",
    ]);
    expect(results.map((result) => result.matchKind)).toEqual([
      "title",
      "title",
      "title",
      "title",
      "project",
      "content",
    ]);
  });

  it("uses deterministic title ordering when recent activity ties", () => {
    rebuildIndex([
      { id: "z", type: "doc", title: "Zebra", content: "", workspaceId: "w", projectId: "p", created: "2026-08-09" },
      { id: "a", type: "doc", title: "Alpha", content: "", workspaceId: "w", projectId: "p", created: "2026-08-09" },
    ]);

    expect(getRecentItems().map((result) => result.item.id)).toEqual(["a", "z"]);
  });
});
