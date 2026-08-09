import type { ProjectStatus, TaskPriority, TaskStatus } from "../types";
import { FILE_NAMES, WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDeskPath, joinPath } from "./env";
import {
  decodeDocFrontmatter,
  decodeMeetingFrontmatter,
  decodeProjectFrontmatter,
  decodeTaskFrontmatter,
  decodeWorkspaceFrontmatter,
} from "./frontmatter";
import {
  findFileById,
} from "./file-operations";
import {
  createMarkdownRecord,
  mutateMarkdownRecord,
  readMarkdownRecord,
  type MarkdownRecordSnapshot,
} from "./markdown-record-repository";
import { nowISO } from "./parser";
import { getDocsPath, getMeetingsPath, getTasksPath } from "./paths";
import { getStorage } from "./storage";

export type EditorDocumentRef =
  | { kind: "task"; workspaceId: string; projectId: string; id: string }
  | { kind: "document"; workspaceId: string; projectId: string; id: string }
  | { kind: "meeting"; workspaceId: string; projectId: string; id: string }
  | { kind: "workspace-overview"; workspaceId: string }
  | { kind: "project-overview"; workspaceId: string; projectId: string };

export interface TaskEditorMetadata {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
  completed?: string;
  author?: "ai";
}

export interface DocumentEditorMetadata {
  title: string;
  created?: string;
  updated?: string;
  author?: "ai";
}

export interface MeetingEditorMetadata extends DocumentEditorMetadata {
  date?: string;
}

export interface WorkspaceOverviewEditorMetadata {
  name: string;
  description?: string;
  color?: string;
  created: string;
  home: boolean;
}

export interface ProjectOverviewEditorMetadata {
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;
}

interface EditorSnapshotBase<
  Kind extends EditorDocumentRef["kind"],
  Ref extends EditorDocumentRef,
  Metadata,
> {
  kind: Kind;
  ref: Ref;
  filePath: string;
  revision: string;
  body: string;
  metadata: Metadata;
}

export type EditorDocumentSnapshot =
  | EditorSnapshotBase<"task", Extract<EditorDocumentRef, { kind: "task" }>, TaskEditorMetadata>
  | EditorSnapshotBase<"document", Extract<EditorDocumentRef, { kind: "document" }>, DocumentEditorMetadata>
  | EditorSnapshotBase<"meeting", Extract<EditorDocumentRef, { kind: "meeting" }>, MeetingEditorMetadata>
  | EditorSnapshotBase<"workspace-overview", Extract<EditorDocumentRef, { kind: "workspace-overview" }>, WorkspaceOverviewEditorMetadata>
  | EditorSnapshotBase<"project-overview", Extract<EditorDocumentRef, { kind: "project-overview" }>, ProjectOverviewEditorMetadata>;

export type EditorDocumentPatch =
  | {
      kind: "task";
      body?: string;
      title?: string;
      status?: TaskStatus;
      priority?: TaskPriority | null;
      due?: string | null;
    }
  | { kind: "document"; body?: string; title?: string }
  | { kind: "meeting"; body?: string; title?: string; date?: string | null }
  | { kind: "workspace-overview"; body?: string }
  | { kind: "project-overview"; body?: string };

export interface SaveEditorDocumentInput {
  ref: EditorDocumentRef;
  /** `null` is reserved for explicit missing-file recreation. */
  expectedRevision: string | null;
  patch: EditorDocumentPatch;
  /** Last confirmed snapshot used only when recreating a missing record. */
  baseSnapshot?: EditorDocumentSnapshot;
}

export type SaveEditorDocumentResult =
  | { status: "saved"; snapshot: EditorDocumentSnapshot }
  | { status: "conflict"; current: EditorDocumentSnapshot }
  | { status: "missing"; reason?: "document" | "parent" };

/** Fresh canonical read: deliberately bypasses list/tree caches. */
export async function getEditorDocument(
  ref: EditorDocumentRef,
): Promise<EditorDocumentSnapshot | null> {
  const filePath = await resolveEditorDocumentPath(ref);
  if (!filePath) return null;
  const record = await readMarkdownRecord<Record<string, unknown>>(filePath);
  return record ? toEditorSnapshot(ref, record) : null;
}

export async function saveEditorDocument(
  input: SaveEditorDocumentInput,
): Promise<SaveEditorDocumentResult> {
  if (input.ref.kind !== input.patch.kind) {
    throw new Error("Editor document ref and patch kinds must match");
  }
  if ("title" in input.patch && input.patch.title !== undefined && !input.patch.title.trim()) {
    throw new Error("Editor document titles cannot be empty");
  }

  const filePath = await resolveEditorDocumentPath(input.ref);
  if (!filePath) return { status: "missing" };
  if (input.expectedRevision === null) {
    if (!input.baseSnapshot || !sameEditorRef(input.ref, input.baseSnapshot.ref)) {
      throw new Error("Missing-file recreation requires the matching base snapshot");
    }
    if (
      typeof input.baseSnapshot.body !== "string"
      || !input.baseSnapshot.metadata
      || typeof input.baseSnapshot.metadata !== "object"
      || Array.isArray(input.baseSnapshot.metadata)
    ) {
      throw new Error("Invalid editor recreation snapshot");
    }
    const parent = parentDirectory(filePath);
    if (!parent || !(await getStorage().exists(parent))) {
      return { status: "missing", reason: "parent" };
    }
    const baseFrontmatter = frontmatterFromSnapshot(input.baseSnapshot);
    const recreated = applyEditorPatch(
      baseFrontmatter,
      input.baseSnapshot.body,
      input.patch,
    );
    const result = await createMarkdownRecord(
      filePath,
      recreated.frontmatter,
      recreated.content,
      {
        stampUpdated: input.ref.kind === "task"
          || input.ref.kind === "document"
          || input.ref.kind === "meeting",
      },
    );
    if (result.status === "conflict" && result.current) {
      return {
        status: "conflict",
        current: await toEditorSnapshot(input.ref, result.current),
      };
    }
    if (result.status !== "saved") return { status: "missing" };
    return {
      status: "saved",
      snapshot: await toEditorSnapshot(input.ref, result.snapshot),
    };
  }
  const result = await mutateMarkdownRecord<Record<string, unknown>>({
    filePath,
    expectedRevision: input.expectedRevision,
    update: (frontmatter, body) => applyEditorPatch(frontmatter, body, input.patch),
    stampUpdated: input.ref.kind === "task"
      || input.ref.kind === "document"
      || input.ref.kind === "meeting",
  });

  if (result.status === "missing") return result;
  if (result.status === "conflict") {
    if (!result.current) return { status: "missing" };
    return {
      status: "conflict",
      current: await toEditorSnapshot(input.ref, result.current),
    };
  }
  return {
    status: "saved",
    snapshot: await toEditorSnapshot(input.ref, result.snapshot),
  };
}

function parentDirectory(filePath: string): string | null {
  const separator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return separator > 0 ? filePath.slice(0, separator) : null;
}

function applyEditorPatch(
  data: Record<string, unknown>,
  body: string,
  patch: EditorDocumentPatch,
): { frontmatter: Record<string, unknown>; content: string } {
  switch (patch.kind) {
    case "task": {
      const previousStatus = data.status;
      let completed = data.completed;
      if (patch.status === "done" && previousStatus !== "done") completed = nowISO();
      else if (patch.status && patch.status !== "done" && previousStatus === "done") {
        completed = undefined;
      }
      return {
        frontmatter: {
          ...data,
          ...(patch.title !== undefined && { title: patch.title.trim() }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(completed !== data.completed && { completed }),
          ...(patch.priority !== undefined && { priority: patch.priority ?? undefined }),
          ...(patch.due !== undefined && { due: patch.due ?? undefined }),
        },
        content: patch.body ?? body,
      };
    }
    case "document":
      return {
        frontmatter: {
          ...data,
          ...(patch.title !== undefined && { title: patch.title.trim() }),
        },
        content: patch.body ?? body,
      };
    case "meeting":
      return {
        frontmatter: {
          ...data,
          ...(patch.title !== undefined && { title: patch.title.trim() }),
          ...(patch.date !== undefined && { date: patch.date ?? undefined }),
        },
        content: patch.body ?? body,
      };
    case "workspace-overview":
    case "project-overview":
      return { frontmatter: data, content: patch.body ?? body };
  }
}

async function resolveEditorDocumentPath(ref: EditorDocumentRef): Promise<string | null> {
  assertSafeEditorRef(ref);
  switch (ref.kind) {
    case "task":
      return resolveRecordInDirectory(await getTasksPath(ref.workspaceId, ref.projectId), ref.id);
    case "meeting":
      return resolveRecordInDirectory(await getMeetingsPath(ref.workspaceId, ref.projectId), ref.id);
    case "document": {
      const scope = ref.projectId === WORKSPACE_LEVEL_PROJECT_ID ? "workspace" : "project";
      const docsPath = await getDocsPath(scope, ref.workspaceId, ref.projectId);
      return joinPath(docsPath, `${ref.id}.md`);
    }
    case "workspace-overview":
      return joinPath(
        await getDeskPath(),
        "workspaces",
        ref.workspaceId,
        FILE_NAMES.WORKSPACE_MD,
      );
    case "project-overview":
      return joinPath(
        await getDeskPath(),
        "workspaces",
        ref.workspaceId,
        "projects",
        ref.projectId,
        FILE_NAMES.PROJECT_MD,
      );
  }
}

async function resolveRecordInDirectory(directory: string, id: string): Promise<string> {
  return (await findFileById(directory, id)) ?? joinPath(directory, `${id}.md`);
}

function frontmatterFromSnapshot(snapshot: EditorDocumentSnapshot): Record<string, unknown> {
  return { ...snapshot.metadata };
}

function sameEditorRef(left: EditorDocumentRef, right: EditorDocumentRef): boolean {
  if (left.kind !== right.kind || left.workspaceId !== right.workspaceId) return false;
  if (left.kind === "workspace-overview" || right.kind === "workspace-overview") {
    return left.kind === right.kind;
  }
  if (left.projectId !== right.projectId) return false;
  if (
    left.kind === "project-overview"
    || right.kind === "project-overview"
  ) return left.kind === right.kind;
  return left.kind === right.kind && left.id === right.id;
}

function assertSafeEditorRef(ref: EditorDocumentRef): void {
  const values = ref.kind === "workspace-overview"
    ? [ref.workspaceId]
    : ref.kind === "project-overview"
      ? [ref.workspaceId, ref.projectId]
      : [ref.workspaceId, ref.projectId, ref.id];
  for (const [index, value] of values.entries()) {
    const parts = value.replaceAll("\\", "/").split("/");
    const documentPath = ref.kind === "document" && index === values.length - 1;
    if (
      parts.some((part) => !part || part === "." || part === "..")
      || (!documentPath && parts.length > 1)
    ) {
      throw new Error("Editor document reference contains an invalid path segment");
    }
  }
}

async function toEditorSnapshot(
  ref: EditorDocumentRef,
  record: MarkdownRecordSnapshot<Record<string, unknown>>,
): Promise<EditorDocumentSnapshot> {
  const filename = record.filePath.split("/").pop() ?? "";
  const common = {
    filePath: record.filePath,
    revision: record.revision,
    body: record.content,
  };
  switch (ref.kind) {
    case "task":
      return {
        ...common,
        kind: ref.kind,
        ref,
        metadata: decodeTaskFrontmatter(record.frontmatter, ref.id, filename).value,
      };
    case "document":
      return {
        ...common,
        kind: ref.kind,
        ref,
        metadata: decodeDocFrontmatter(record.frontmatter, ref.id, filename).value,
      };
    case "meeting":
      return {
        ...common,
        kind: ref.kind,
        ref,
        metadata: decodeMeetingFrontmatter(record.frontmatter, ref.id, filename).value,
      };
    case "workspace-overview":
      return {
        ...common,
        kind: ref.kind,
        ref,
        metadata: decodeWorkspaceFrontmatter(record.frontmatter, ref.workspaceId).value,
      };
    case "project-overview":
      return {
        ...common,
        kind: ref.kind,
        ref,
        metadata: decodeProjectFrontmatter(record.frontmatter, ref.projectId).value,
      };
  }
}
