export interface DeskRpcValidationIssue {
  path: string;
  message: string;
}

type ScalarKind = "string" | "boolean";

interface FieldRule {
  kind: ScalarKind;
  required?: boolean;
  nullable?: boolean;
  values?: readonly string[];
}

interface ObjectRule {
  argument: number;
  fields: Record<string, FieldRule>;
}

const TASK_STATUSES = ["backlog", "todo", "doing", "waiting", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;
const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;

const STRING_REQUIRED: FieldRule = { kind: "string", required: true };
const STRING_OPTIONAL: FieldRule = { kind: "string" };
const STRING_NULLABLE: FieldRule = { kind: "string", nullable: true };

const OBJECT_RULES: Record<string, ObjectRule> = {
  createWorkspace: {
    argument: 0,
    fields: {
      id: STRING_REQUIRED,
      name: STRING_REQUIRED,
      description: STRING_OPTIONAL,
      overview: STRING_OPTIONAL,
      color: STRING_OPTIONAL,
      home: { kind: "boolean" },
    },
  },
  updateWorkspace: {
    argument: 1,
    fields: {
      name: STRING_OPTIONAL,
      description: STRING_NULLABLE,
      overview: STRING_NULLABLE,
      color: STRING_NULLABLE,
    },
  },
  createProject: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      name: STRING_REQUIRED,
      description: STRING_OPTIONAL,
      status: { kind: "string", values: PROJECT_STATUSES },
    },
  },
  updateProject: {
    argument: 1,
    fields: {
      name: STRING_OPTIONAL,
      description: STRING_NULLABLE,
      overview: STRING_NULLABLE,
      status: { kind: "string", values: PROJECT_STATUSES },
    },
  },
  createTask: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      priority: { kind: "string", values: TASK_PRIORITIES },
      due: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  updateTask: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      status: { kind: "string", values: TASK_STATUSES },
      content: STRING_OPTIONAL,
      projectId: STRING_OPTIONAL,
      priority: { kind: "string", nullable: true, values: TASK_PRIORITIES },
      due: STRING_NULLABLE,
    },
  },
  createMeeting: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      date: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  updateMeeting: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      date: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
  createCaptureTask: {
    argument: 0,
    fields: {
      title: STRING_REQUIRED,
      priority: { kind: "string", values: TASK_PRIORITIES },
      due: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
  updateCaptureTask: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      status: { kind: "string", values: TASK_STATUSES },
      content: STRING_OPTIONAL,
      priority: { kind: "string", nullable: true, values: TASK_PRIORITIES },
      due: STRING_NULLABLE,
    },
  },
  createDoc: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  createDocInFolder: {
    argument: 0,
    fields: {
      scope: { kind: "string", required: true, values: ["personal", "workspace", "project"] },
      title: STRING_REQUIRED,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      folderPath: STRING_OPTIONAL,
      workspaceId: STRING_OPTIONAL,
      projectId: STRING_OPTIONAL,
      filename: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
      updatedStamp: STRING_OPTIONAL,
    },
  },
  updateDoc: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
};

/**
 * Validate the entity mutation values that cross the untyped HTTP boundary.
 * Unknown object fields remain allowed for forward compatibility.
 */
export function validateDeskRpcEntityMutation(
  operation: string,
  args: unknown[],
): DeskRpcValidationIssue | null {
  if (operation === "getEditorDocument") {
    return validateEditorRef(args[0], "args[0]");
  }
  if (operation === "saveEditorDocument") {
    return validateEditorSave(args[0], "args[0]");
  }
  if (operation === "moveTask") {
    return validateEnumArgument(args[1], "args[1]", TASK_STATUSES);
  }

  const rule = OBJECT_RULES[operation];
  if (!rule) return null;

  const value = args[rule.argument];
  const path = `args[${rule.argument}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { path, message: "expected an object" };
  }

  const record = value as Record<string, unknown>;
  for (const [field, fieldRule] of Object.entries(rule.fields)) {
    const fieldValue = record[field];
    const fieldPath = `${path}.${field}`;
    if (fieldValue === undefined) {
      if (fieldRule.required) return { path: fieldPath, message: "field is required" };
      continue;
    }
    if (fieldValue === null && fieldRule.nullable) continue;
    if (typeof fieldValue !== fieldRule.kind) {
      return { path: fieldPath, message: `expected ${fieldRule.kind}` };
    }
    if (
      fieldRule.values &&
      !fieldRule.values.includes(fieldValue as string)
    ) {
      return {
        path: fieldPath,
        message: `expected one of ${fieldRule.values.join(", ")}`,
      };
    }
  }

  return null;
}

const EDITOR_KINDS = [
  "task",
  "document",
  "meeting",
  "workspace-overview",
  "project-overview",
] as const;

function validateEditorSave(value: unknown, path: string): DeskRpcValidationIssue | null {
  if (!isRecord(value)) return { path, message: "expected an object" };
  if (
    value.expectedRevision !== null
    && (typeof value.expectedRevision !== "string" || !value.expectedRevision)
  ) {
    return { path: `${path}.expectedRevision`, message: "expected a non-empty string or null" };
  }
  const refIssue = validateEditorRef(value.ref, `${path}.ref`);
  if (refIssue) return refIssue;
  if (value.expectedRevision === null) {
    if (!isRecord(value.baseSnapshot) || !isRecord(value.baseSnapshot.ref)) {
      return { path: `${path}.baseSnapshot`, message: "required for recreation" };
    }
    const baseRefIssue = validateEditorRef(value.baseSnapshot.ref, `${path}.baseSnapshot.ref`);
    if (baseRefIssue) return baseRefIssue;
    if (JSON.stringify(value.ref) !== JSON.stringify(value.baseSnapshot.ref)) {
      return { path: `${path}.baseSnapshot.ref`, message: "must match ref" };
    }
  }
  if (!isRecord(value.patch)) {
    return { path: `${path}.patch`, message: "expected an object" };
  }
  const ref = value.ref as Record<string, unknown>;
  if (value.patch.kind !== ref.kind) {
    return { path: `${path}.patch.kind`, message: "must match ref.kind" };
  }
  if ("body" in value.patch && typeof value.patch.body !== "string") {
    return { path: `${path}.patch.body`, message: "expected string" };
  }
  if ("title" in value.patch) {
    if (typeof value.patch.title !== "string" || !value.patch.title.trim()) {
      return { path: `${path}.patch.title`, message: "expected a non-empty string" };
    }
  }
  if (value.patch.kind === "task") {
    if ("status" in value.patch && !TASK_STATUSES.includes(value.patch.status as never)) {
      return { path: `${path}.patch.status`, message: `expected one of ${TASK_STATUSES.join(", ")}` };
    }
    if (
      "priority" in value.patch
      && value.patch.priority !== null
      && !TASK_PRIORITIES.includes(value.patch.priority as never)
    ) {
      return { path: `${path}.patch.priority`, message: `expected one of ${TASK_PRIORITIES.join(", ")} or null` };
    }
    if (
      "due" in value.patch
      && value.patch.due !== null
      && typeof value.patch.due !== "string"
    ) {
      return { path: `${path}.patch.due`, message: "expected string or null" };
    }
  }
  if (
    value.patch.kind === "meeting"
    && "date" in value.patch
    && value.patch.date !== null
    && typeof value.patch.date !== "string"
  ) {
    return { path: `${path}.patch.date`, message: "expected string or null" };
  }
  return null;
}

function validateEditorRef(value: unknown, path: string): DeskRpcValidationIssue | null {
  if (!isRecord(value)) return { path, message: "expected an object" };
  if (!EDITOR_KINDS.includes(value.kind as never)) {
    return { path: `${path}.kind`, message: `expected one of ${EDITOR_KINDS.join(", ")}` };
  }
  const required = value.kind === "workspace-overview"
    ? ["workspaceId"]
    : value.kind === "project-overview"
      ? ["workspaceId", "projectId"]
      : ["workspaceId", "projectId", "id"];
  for (const field of required) {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string" || !fieldValue) {
      return { path: `${path}.${field}`, message: "expected a non-empty string" };
    }
    const parts = fieldValue.replaceAll("\\", "/").split("/");
    const allowsFolders = value.kind === "document" && field === "id";
    if (parts.some((part) => !part || part === "." || part === "..") || (!allowsFolders && parts.length > 1)) {
      return { path: `${path}.${field}`, message: "contains an invalid path segment" };
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateEnumArgument(
  value: unknown,
  path: string,
  allowed: readonly string[],
): DeskRpcValidationIssue | null {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { path, message: `expected one of ${allowed.join(", ")}` };
  }
  return null;
}
