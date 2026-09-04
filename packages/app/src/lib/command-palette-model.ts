export type PaletteScope = "all" | "workspace";
export type PaletteView = "search" | "capture" | "workspaces";
export type PaletteModal = "task" | "doc" | "meeting" | "project";

export type PaletteCommandId =
  | "capture-task"
  | "create-task"
  | "create-doc"
  | "create-meeting"
  | "create-project"
  | "switch-workspace"
  | "go-dashboard"
  | "go-planner"
  | "go-tasks"
  | "go-docs"
  | "go-meetings"
  | "go-projects"
  | "open-settings"
  | "view-shortcuts";

export type PaletteCommandIcon =
  | "capture"
  | "task"
  | "doc"
  | "meeting"
  | "project"
  | "workspace"
  | "dashboard"
  | "planner"
  | "settings"
  | "shortcuts";

export type PaletteCommandAction =
  | { kind: "capture" }
  | { kind: "modal"; modal: PaletteModal }
  | { kind: "workspaces" }
  | { kind: "navigate"; path: string }
  | { kind: "shortcuts" };

export interface PaletteCommand {
  id: PaletteCommandId;
  label: string;
  aliases: string[];
  icon: PaletteCommandIcon;
  action: PaletteCommandAction;
  disabled: boolean;
  disabledReason?: string;
}

interface PaletteCommandContext {
  hasWorkspace: boolean;
  hasProjects: boolean;
}

type Translate = (key: string) => string;

interface PaletteCommandSpec {
  id: PaletteCommandId;
  icon: PaletteCommandIcon;
  action: PaletteCommandAction;
  requiresWorkspace?: boolean;
  requiresProject?: boolean;
}

const COMMAND_SPECS: PaletteCommandSpec[] = [
  { id: "capture-task", icon: "capture", action: { kind: "capture" } },
  { id: "create-task", icon: "task", action: { kind: "modal", modal: "task" }, requiresWorkspace: true },
  { id: "create-doc", icon: "doc", action: { kind: "modal", modal: "doc" }, requiresWorkspace: true },
  { id: "create-meeting", icon: "meeting", action: { kind: "modal", modal: "meeting" }, requiresWorkspace: true, requiresProject: true },
  { id: "create-project", icon: "project", action: { kind: "modal", modal: "project" }, requiresWorkspace: true },
  { id: "switch-workspace", icon: "workspace", action: { kind: "workspaces" }, requiresWorkspace: true },
  { id: "go-dashboard", icon: "dashboard", action: { kind: "navigate", path: "/" } },
  { id: "go-planner", icon: "planner", action: { kind: "navigate", path: "/planner" } },
  { id: "go-tasks", icon: "task", action: { kind: "navigate", path: "/tasks" } },
  { id: "go-docs", icon: "doc", action: { kind: "navigate", path: "/docs" } },
  { id: "go-meetings", icon: "meeting", action: { kind: "navigate", path: "/meetings" } },
  { id: "go-projects", icon: "project", action: { kind: "navigate", path: "/projects" } },
  { id: "open-settings", icon: "settings", action: { kind: "navigate", path: "/settings" } },
  { id: "view-shortcuts", icon: "shortcuts", action: { kind: "shortcuts" } },
];

export const DEFAULT_PALETTE_COMMAND_IDS: PaletteCommandId[] = [
  "capture-task",
  "create-task",
  "create-doc",
  "go-planner",
];

export const RECENT_PALETTE_LIMIT = 6;

export function getPaletteWorkspaceScope(
  scope: PaletteScope,
  currentWorkspaceId: string | null,
): string | undefined {
  return scope === "workspace" ? currentWorkspaceId ?? undefined : undefined;
}

function splitAliases(value: string): string[] {
  return value.split("|").map((alias) => alias.trim()).filter(Boolean);
}

export function buildPaletteCommands(
  t: Translate,
  context: PaletteCommandContext,
): PaletteCommand[] {
  return COMMAND_SPECS.map((spec) => {
    const disabledReason = spec.requiresWorkspace && !context.hasWorkspace
      ? t("search.commandPalette.disabled.workspace")
      : spec.requiresProject && !context.hasProjects
        ? t("search.commandPalette.disabled.meetingProject")
        : undefined;

    const translationKey = spec.id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return {
      id: spec.id,
      label: t(`search.commandPalette.commands.${translationKey}.label`),
      aliases: splitAliases(t(`search.commandPalette.commands.${translationKey}.aliases`)),
      icon: spec.icon,
      action: spec.action,
      disabled: disabledReason !== undefined,
      disabledReason,
    };
  });
}

export function getDefaultPaletteCommands(commands: PaletteCommand[]): PaletteCommand[] {
  const byId = new Map(commands.map((command) => [command.id, command]));
  return DEFAULT_PALETTE_COMMAND_IDS.flatMap((id) => {
    const command = byId.get(id);
    return command ? [command] : [];
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function filterPaletteWorkspaces<T extends { name: string }>(
  workspaces: T[],
  query: string,
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return workspaces;
  return workspaces.filter((workspace) => normalize(workspace.name).includes(normalizedQuery));
}

function matchRank(command: PaletteCommand, rawQuery: string): number | null {
  const query = normalize(rawQuery);
  if (!query) return null;

  const label = normalize(command.label);
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.split(" ").some((word) => word.startsWith(query))) return 2;
  if (label.includes(query)) return 3;

  const aliases = command.aliases.map(normalize);
  if (aliases.some((value) => value === query)) return 1;
  if (aliases.some((value) => value.startsWith(query))) return 2;
  if (aliases.some((value) => value.split(" ").some((word) => word.startsWith(query)))) return 3;
  if (aliases.some((value) => value.includes(query))) return 4;
  return null;
}

export function matchPaletteCommands(
  commands: PaletteCommand[],
  query: string,
  limit: number = 3,
): PaletteCommand[] {
  return commands
    .map((command, index) => ({ command, index, rank: matchRank(command, query) }))
    .filter((entry): entry is { command: PaletteCommand; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.command);
}

export interface CommandPaletteState {
  open: boolean;
  query: string;
  returnQuery: string;
  scope: PaletteScope;
  view: PaletteView;
  captureTitle: string;
}

export type CommandPaletteEvent =
  | { type: "open" }
  | { type: "toggle" }
  | { type: "close" }
  | { type: "set-query"; query: string }
  | { type: "set-scope"; scope: PaletteScope }
  | { type: "enter-capture" }
  | { type: "leave-capture" }
  | { type: "enter-workspaces" }
  | { type: "leave-workspaces" }
  | { type: "set-capture-title"; title: string }
  | { type: "capture-succeeded" }
  | { type: "capture-failed" };

export function handlePaletteEscape(
  view: PaletteView,
  event: Pick<KeyboardEvent, "preventDefault">,
  dispatch: (event: CommandPaletteEvent) => void,
  canLeave: boolean = true,
): boolean {
  const leaveEvent: CommandPaletteEvent | null = view === "capture"
    ? { type: "leave-capture" }
    : view === "workspaces"
      ? { type: "leave-workspaces" }
      : null;
  if (!leaveEvent) return false;

  event.preventDefault();
  if (canLeave) dispatch(leaveEvent);
  return true;
}

export function createInitialCommandPaletteState(): CommandPaletteState {
  return {
    open: false,
    query: "",
    returnQuery: "",
    scope: "all",
    view: "search",
    captureTitle: "",
  };
}

export function commandPaletteReducer(
  state: CommandPaletteState,
  event: CommandPaletteEvent,
): CommandPaletteState {
  switch (event.type) {
    case "open":
      return { ...createInitialCommandPaletteState(), open: true };
    case "toggle":
      return state.open
        ? createInitialCommandPaletteState()
        : { ...createInitialCommandPaletteState(), open: true };
    case "close":
    case "capture-succeeded":
      return createInitialCommandPaletteState();
    case "set-query":
      return { ...state, query: event.query };
    case "set-scope":
      return { ...state, scope: event.scope };
    case "enter-capture":
      return { ...state, view: "capture", returnQuery: state.query, captureTitle: "" };
    case "leave-capture":
      return { ...state, view: "search", query: state.returnQuery, captureTitle: "" };
    case "enter-workspaces":
      return { ...state, view: "workspaces", returnQuery: state.query, query: "" };
    case "leave-workspaces":
      return { ...state, view: "search", query: state.returnQuery };
    case "set-capture-title":
      return { ...state, captureTitle: event.title };
    case "capture-failed":
      return state;
  }
}
