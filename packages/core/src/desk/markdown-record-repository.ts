import { hashContent } from "./catalog/content-utils";
import { publishDomainWrite, type DomainWriteKind } from "./domain-write-bus";
import { getContentCache } from "./file-cache";
import { nowISO, parseMarkdown, serializeMarkdown } from "./parser";
import { getStorage } from "./storage";

export interface MarkdownRecordSnapshot<T extends Record<string, unknown>> {
  filePath: string;
  raw: string;
  revision: string;
  frontmatter: T;
  content: string;
}

export type MarkdownRecordMutationResult<T extends Record<string, unknown>> =
  | { status: "saved"; snapshot: MarkdownRecordSnapshot<T> }
  | { status: "conflict"; current: MarkdownRecordSnapshot<T> | null }
  | { status: "missing" };

export interface MutateMarkdownRecordOptions<T extends Record<string, unknown>> {
  filePath: string;
  /** Undefined retries legacy mutations; a value is a strict editor revision check. */
  expectedRevision?: string;
  update: (
    frontmatter: T,
    content: string,
  ) => { frontmatter: T; content: string };
  stampUpdated?: boolean;
  updatedStamp?: string;
  eventKind?: Extract<DomainWriteKind, "write" | "update">;
}

const pathQueues = new Map<string, Promise<void>>();

/** SHA-256 of the complete canonical record, including frontmatter and body. */
export function markdownRevision(raw: string): Promise<string> {
  return hashContent(raw);
}

export async function readMarkdownRecord<T extends Record<string, unknown>>(
  filePath: string,
): Promise<MarkdownRecordSnapshot<T> | null> {
  const storage = getStorage();
  if (!(await storage.exists(filePath))) return null;
  const raw = await storage.readTextFile(filePath);
  return snapshotFromRaw<T>(filePath, raw);
}

export async function snapshotFromRaw<T extends Record<string, unknown>>(
  filePath: string,
  raw: string,
): Promise<MarkdownRecordSnapshot<T>> {
  const parsed = parseMarkdown<T>(raw);
  return {
    filePath,
    raw,
    revision: await markdownRevision(raw),
    frontmatter: parsed.data,
    content: parsed.content,
  };
}

/**
 * Apply a typed change to a freshly read Markdown record.
 *
 * All in-process writers for one normalized path are serialized, and each host
 * admits one DeskMD writer process per data root. Revision checks detect external
 * edits observed before commit; arbitrary external writers do not participate in
 * DeskMD's ownership lock, so plain filesystems cannot provide them a true CAS.
 */
export function mutateMarkdownRecord<T extends Record<string, unknown>>(
  options: MutateMarkdownRecordOptions<T>,
): Promise<MarkdownRecordMutationResult<T>> {
  return enqueuePath(options.filePath, async () => {
    const strict = options.expectedRevision !== undefined;
    const attempts = strict ? 1 : 3;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const current = await readMarkdownRecord<T>(options.filePath);
      if (!current) return { status: "missing" };
      if (strict && current.revision !== options.expectedRevision) {
        return { status: "conflict", current };
      }

      const updated = options.update(current.frontmatter, current.content);
      const frontmatter = options.stampUpdated
        ? {
            ...updated.frontmatter,
            updated: options.updatedStamp ?? nowISO(),
          }
        : updated.frontmatter;
      const nextRaw = serializeMarkdown(frontmatter, updated.content);
      const latest = await readMarkdownRecord<T>(options.filePath);
      if (latest?.raw === current.raw) {
        await getStorage().replaceTextFileAtomically(options.filePath, nextRaw);
        const snapshot = await snapshotFromRaw<T>(options.filePath, nextRaw);
        afterRecordCommit(options.filePath, options.eventKind ?? "update");
        return { status: "saved", snapshot };
      }

      const conflict = latest;
      if (strict || attempt === attempts - 1) {
        return conflict
          ? { status: "conflict", current: conflict }
          : { status: "missing" };
      }
    }

    throw new Error("Unreachable Markdown mutation state");
  });
}

/** Create a new canonical record without replacing a racing external file. */
export function createMarkdownRecord<T extends Record<string, unknown>>(
  filePath: string,
  frontmatter: T,
  content: string,
  options: {
    stampUpdated?: boolean;
    updatedStamp?: string;
    eventKind?: Extract<DomainWriteKind, "write" | "update">;
  } = {},
): Promise<MarkdownRecordMutationResult<T>> {
  return enqueuePath(filePath, async () => {
    const stamped = options.stampUpdated
      ? { ...frontmatter, updated: options.updatedStamp ?? nowISO() }
      : frontmatter;
    const raw = serializeMarkdown(stamped, content);
    const result = await getStorage().createTextFileAtomically(filePath, raw);
    if (result.status === "exists") {
      const current = result.current === null
        ? null
        : await snapshotFromRaw<T>(filePath, result.current);
      return { status: "conflict", current };
    }
    const snapshot = await snapshotFromRaw<T>(filePath, raw);
    afterRecordCommit(filePath, options.eventKind ?? "write");
    return { status: "saved", snapshot };
  });
}

function afterRecordCommit(
  filePath: string,
  kind: Extract<DomainWriteKind, "write" | "update">,
): void {
  getContentCache().invalidate(filePath);
  publishDomainWrite({ kind, filePath });
}

function enqueuePath<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const key = normalizeQueuePath(filePath);
  const previous = pathQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  pathQueues.set(key, settled);
  void settled.finally(() => {
    if (pathQueues.get(key) === settled) pathQueues.delete(key);
  });
  return run;
}

function normalizeQueuePath(path: string): string {
  const prefix = path.startsWith("/") ? "/" : "";
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `${prefix}${parts.join("/")}`;
}

export function resetMarkdownRecordRepository(): void {
  pathQueues.clear();
}
