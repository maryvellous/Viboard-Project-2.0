import { chmod, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDeskService, parseMarkdown, serializeMarkdown } from "@desk/core";
import {
  InMemoryStorageProvider,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";
import { NodeFsProvider } from "../../packages/server/src/node-fs-provider";

class ObservedMemoryProvider extends InMemoryStorageProvider {
  active = 0;
  maximumActive = 0;

  override async replaceTextFileAtomically(
    path: string,
    content: string,
  ): Promise<void> {
    this.active++;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    try {
      return await super.replaceTextFileAtomically(path, content);
    } finally {
      this.active--;
    }
  }
}

describe("versioned editor persistence", () => {
  let provider: ObservedMemoryProvider;
  let taskId: string;

  beforeEach(async () => {
    resetDeskRuntime();
    provider = new ObservedMemoryProvider();
    setStorage(provider);
    setDataRootResolver(async () => "/desk");
    const service = getDeskService();
    await service.createWorkspace({ id: "acme", name: "Acme", home: true });
    const project = await service.createProject({ workspaceId: "acme", name: "Website" });
    const task = await service.createTask({
      workspaceId: "acme",
      projectId: project.id,
      title: "Ship",
      content: "original",
    });
    taskId = task.id;
    provider.maximumActive = 0;
  });

  afterEach(() => resetDeskRuntime());

  it("commits body and metadata together while preserving unknown frontmatter", async () => {
    const service = getDeskService();
    const ref = { kind: "task", workspaceId: "acme", projectId: "website", id: taskId } as const;
    const initial = await service.getEditorDocument(ref);
    expect(initial?.kind).toBe("task");
    if (!initial) throw new Error("missing fixture");

    const parsed = parseMarkdown<Record<string, unknown>>(
      await provider.readTextFile(initial.filePath),
    );
    await provider.writeTextFile(
      initial.filePath,
      serializeMarkdown({ ...parsed.data, custom: "keep-me" }, parsed.content),
    );
    const fresh = await service.getEditorDocument(ref);
    if (!fresh) throw new Error("missing fixture");

    const result = await service.saveEditorDocument({
      ref,
      expectedRevision: fresh.revision,
      patch: { kind: "task", body: "new body", status: "doing", priority: "high" },
    });
    expect(result.status).toBe("saved");
    const raw = await provider.readTextFile(initial.filePath);
    const committed = parseMarkdown<Record<string, unknown>>(raw);
    expect(committed.content.trim()).toBe("new body");
    expect(committed.data).toMatchObject({
      status: "doing",
      priority: "high",
      custom: "keep-me",
    });
    expect(typeof committed.data.updated).toBe("string");
  });

  it("returns a conflict for body or frontmatter changes without overwriting", async () => {
    const service = getDeskService();
    const ref = { kind: "task", workspaceId: "acme", projectId: "website", id: taskId } as const;
    const initial = await service.getEditorDocument(ref);
    if (!initial) throw new Error("missing fixture");
    const parsed = parseMarkdown<Record<string, unknown>>(await provider.readTextFile(initial.filePath));
    const externalRaw = serializeMarkdown({ ...parsed.data, title: "External" }, parsed.content);
    await provider.writeTextFile(initial.filePath, externalRaw);

    const result = await service.saveEditorDocument({
      ref,
      expectedRevision: initial.revision,
      patch: { kind: "task", body: "Desk draft" },
    });
    expect(result.status).toBe("conflict");
    if (result.status === "conflict" && result.current.kind === "task") {
      expect(result.current.metadata.title).toBe("External");
    }
    expect(await provider.readTextFile(initial.filePath)).toBe(externalRaw);
  });

  it("serializes all mutations to one path", async () => {
    const service = getDeskService();
    await Promise.all([
      service.updateTask(taskId, { status: "doing" }, "acme", "website"),
      service.updateTask(taskId, { priority: "high" }, "acme", "website"),
      service.updateTask(taskId, { content: "latest" }, "acme", "website"),
    ]);
    expect(provider.maximumActive).toBe(1);
    const task = await service.getTask("acme", "website", taskId);
    expect(task).toMatchObject({ status: "doing", priority: "high", content: expect.stringContaining("latest") });
  });

  it("recreates a deleted record without replacing a racing new file", async () => {
    const service = getDeskService();
    const ref = { kind: "task", workspaceId: "acme", projectId: "website", id: taskId } as const;
    const baseSnapshot = await service.getEditorDocument(ref);
    if (!baseSnapshot) throw new Error("missing fixture");
    await provider.removeFile(baseSnapshot.filePath);

    const recreated = await service.saveEditorDocument({
      ref,
      expectedRevision: null,
      baseSnapshot,
      patch: { kind: "task", body: "protected draft", title: "Recovered", status: "doing" },
    });
    expect(recreated.status).toBe("saved");
    expect((await service.getEditorDocument(ref))?.body.trim()).toBe("protected draft");

    const raced = await service.saveEditorDocument({
      ref,
      expectedRevision: null,
      baseSnapshot,
      patch: { kind: "task", body: "must not overwrite" },
    });
    expect(raced.status).toBe("conflict");
    expect((await service.getEditorDocument(ref))?.body.trim()).toBe("protected draft");
  });

  it("retains recovery responsibility when the record parent was deleted", async () => {
    const root = await mkdtemp(join(tmpdir(), "deskmd-parent-recovery-"));
    try {
      resetDeskRuntime();
      const storage = new NodeFsProvider(root);
      setStorage(storage);
      setDataRootResolver(async () => root);
      const service = getDeskService();
      await service.createWorkspace({ id: "acme", name: "Acme", home: true });
      const project = await service.createProject({ workspaceId: "acme", name: "Website" });
      const task = await service.createTask({
        workspaceId: "acme",
        projectId: project.id,
        title: "Ship",
        content: "original",
      });
      const ref = {
        kind: "task",
        workspaceId: "acme",
        projectId: project.id,
        id: task.id,
      } as const;
      const baseSnapshot = await service.getEditorDocument(ref);
      if (!baseSnapshot) throw new Error("missing fixture");
      await rm(dirname(baseSnapshot.filePath), { recursive: true, force: true });

      await expect(service.saveEditorDocument({
        ref,
        expectedRevision: null,
        baseSnapshot,
        patch: { kind: "task", body: "protected draft" },
      })).resolves.toEqual({ status: "missing", reason: "parent" });
      await expect(stat(dirname(baseSnapshot.filePath))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Node atomic text persistence", () => {
  it("keeps conflicts intact and cleans same-directory temporary files", async () => {
    const root = await mkdtemp(join(tmpdir(), "deskmd-cas-"));
    try {
      const provider = new NodeFsProvider(root);
      const path = join(root, "record.md");
      await provider.writeTextFile(path, "original");
      await chmod(path, 0o640);
      expect(await provider.createTextFileAtomically(path, "wrong")).toEqual({
        status: "exists",
        current: "original",
      });
      expect(await readFile(path, "utf8")).toBe("original");
      await provider.replaceTextFileAtomically(path, "saved");
      expect(await readFile(path, "utf8")).toBe("saved");
      expect((await stat(path)).mode & 0o777).toBe(0o640);
      const createdPath = join(root, "created.md");
      expect(await provider.createTextFileAtomically(createdPath, "created")).toEqual({
        status: "created",
      });
      expect(await readFile(createdPath, "utf8")).toBe("created");
      expect((await readdir(root)).filter((name) => name.startsWith(".deskmd-write-"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
