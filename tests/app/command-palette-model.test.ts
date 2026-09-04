import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE_COMMAND_IDS,
  buildPaletteCommands,
  commandPaletteReducer,
  createInitialCommandPaletteState,
  filterPaletteWorkspaces,
  getDefaultPaletteCommands,
  getPaletteWorkspaceScope,
  handlePaletteEscape,
  matchPaletteCommands,
  RECENT_PALETTE_LIMIT,
} from "../../packages/app/src/lib/command-palette-model";

const messages: Record<string, string> = {
  "search.commandPalette.commands.captureTask.label": "Capture task to Inbox",
  "search.commandPalette.commands.captureTask.aliases": "capture|inbox|remember|quick task",
  "search.commandPalette.commands.createTask.label": "Create task",
  "search.commandPalette.commands.createTask.aliases": "new task|add task|todo",
  "search.commandPalette.commands.createDoc.label": "Create document",
  "search.commandPalette.commands.createDoc.aliases": "new document|add document|doc|note",
  "search.commandPalette.commands.createMeeting.label": "Create meeting",
  "search.commandPalette.commands.createMeeting.aliases": "new meeting|add meeting|appointment",
  "search.commandPalette.commands.createProject.label": "Create project",
  "search.commandPalette.commands.createProject.aliases": "new project|add project",
  "search.commandPalette.commands.switchWorkspace.label": "Switch workspace",
  "search.commandPalette.commands.switchWorkspace.aliases": "workspace|change workspace|team|space",
  "search.commandPalette.commands.goDashboard.label": "Go to Dashboard",
  "search.commandPalette.commands.goDashboard.aliases": "home|overview",
  "search.commandPalette.commands.goPlanner.label": "Go to Planner",
  "search.commandPalette.commands.goPlanner.aliases": "plan|calendar|week|schedule",
  "search.commandPalette.commands.goTasks.label": "Go to Tasks",
  "search.commandPalette.commands.goTasks.aliases": "tasks|todos",
  "search.commandPalette.commands.goDocs.label": "Go to Documents",
  "search.commandPalette.commands.goDocs.aliases": "documents|docs|notes",
  "search.commandPalette.commands.goMeetings.label": "Go to Meetings",
  "search.commandPalette.commands.goMeetings.aliases": "meetings|appointments",
  "search.commandPalette.commands.goProjects.label": "Go to Projects",
  "search.commandPalette.commands.goProjects.aliases": "projects",
  "search.commandPalette.commands.openSettings.label": "Open Settings",
  "search.commandPalette.commands.openSettings.aliases": "preferences|configuration",
  "search.commandPalette.commands.viewShortcuts.label": "View keyboard shortcuts",
  "search.commandPalette.commands.viewShortcuts.aliases": "keys|hotkeys|help",
  "search.commandPalette.disabled.workspace": "Select a workspace first",
  "search.commandPalette.disabled.meetingProject": "Create a project first",
};

const t = (key: string) => messages[key] ?? key;

describe("command palette model", () => {
  it("builds the exact v1 catalog in stable order", () => {
    const commands = buildPaletteCommands(t, { hasWorkspace: true, hasProjects: true });

    expect(commands.map((command) => command.id)).toEqual([
      "capture-task",
      "create-task",
      "create-doc",
      "create-meeting",
      "create-project",
      "switch-workspace",
      "go-dashboard",
      "go-planner",
      "go-tasks",
      "go-docs",
      "go-meetings",
      "go-projects",
      "open-settings",
      "view-shortcuts",
    ]);
  });

  it("selects exactly the four agreed default actions", () => {
    const commands = buildPaletteCommands(t, { hasWorkspace: true, hasProjects: true });

    expect(DEFAULT_PALETTE_COMMAND_IDS).toEqual([
      "capture-task",
      "create-task",
      "create-doc",
      "go-planner",
    ]);
    expect(getDefaultPaletteCommands(commands).map((command) => command.id)).toEqual(
      DEFAULT_PALETTE_COMMAND_IDS,
    );
  });

  it("matches labels and aliases with deterministic ranking and a three-command cap", () => {
    const commands = buildPaletteCommands(t, { hasWorkspace: true, hasProjects: true });

    expect(matchPaletteCommands(commands, "meet").map((command) => command.id)).toEqual([
      "create-meeting",
      "go-meetings",
    ]);
    expect(matchPaletteCommands(commands, "new").map((command) => command.id)).toEqual([
      "create-task",
      "create-doc",
      "create-meeting",
    ]);
    expect(matchPaletteCommands(commands, "RéMeMbEr").map((command) => command.id)).toEqual([
      "capture-task",
    ]);
  });

  it("keeps unavailable commands searchable with a useful disabled reason", () => {
    const withoutWorkspace = buildPaletteCommands(t, { hasWorkspace: false, hasProjects: false });
    const meeting = withoutWorkspace.find((command) => command.id === "create-meeting");

    expect(meeting).toMatchObject({ disabled: true, disabledReason: "Select a workspace first" });

    const withoutProjects = buildPaletteCommands(t, { hasWorkspace: true, hasProjects: false });
    expect(withoutProjects.find((command) => command.id === "create-meeting")).toMatchObject({
      disabled: true,
      disabledReason: "Create a project first",
    });
  });

  it("restores the previous query when leaving capture and fully resets after success", () => {
    let state = createInitialCommandPaletteState();
    state = commandPaletteReducer(state, { type: "open" });
    state = commandPaletteReducer(state, { type: "set-query", query: "capture" });
    state = commandPaletteReducer(state, { type: "enter-capture" });
    state = commandPaletteReducer(state, { type: "set-capture-title", title: "  Call Alex  " });

    expect(state).toMatchObject({ open: true, view: "capture", returnQuery: "capture" });

    state = commandPaletteReducer(state, { type: "leave-capture" });
    expect(state).toMatchObject({ open: true, view: "search", query: "capture" });

    state = commandPaletteReducer(state, { type: "enter-capture" });
    state = commandPaletteReducer(state, { type: "capture-succeeded" });
    expect(state).toEqual(createInitialCommandPaletteState());
  });

  it("opens the workspace picker with a clean query and restores the palette query on back", () => {
    let state = commandPaletteReducer(createInitialCommandPaletteState(), { type: "open" });
    state = commandPaletteReducer(state, { type: "set-query", query: "switch" });
    state = commandPaletteReducer(state, { type: "enter-workspaces" });

    expect(state).toMatchObject({
      open: true,
      view: "workspaces",
      query: "",
      returnQuery: "switch",
    });

    state = commandPaletteReducer(state, { type: "set-query", query: "client" });
    state = commandPaletteReducer(state, { type: "leave-workspaces" });
    expect(state).toMatchObject({ open: true, view: "search", query: "switch" });
  });

  it("prevents dialog dismissal and leaves a nested palette view on Escape", () => {
    let state = commandPaletteReducer(createInitialCommandPaletteState(), { type: "open" });
    state = commandPaletteReducer(state, { type: "set-query", query: "switch" });
    state = commandPaletteReducer(state, { type: "enter-workspaces" });
    let prevented = false;

    const handled = handlePaletteEscape(
      state.view,
      { preventDefault: () => { prevented = true; } },
      (event) => { state = commandPaletteReducer(state, event); },
    );

    expect(handled).toBe(true);
    expect(prevented).toBe(true);
    expect(state).toMatchObject({ open: true, view: "search", query: "switch" });
  });

  it("filters workspaces by name without case or accent sensitivity", () => {
    const workspaces = [
      { id: "personal", name: "Personal" },
      { id: "clients", name: "Clïents" },
      { id: "studio", name: "Studio" },
    ];

    expect(filterPaletteWorkspaces(workspaces, "CLIENT")).toEqual([
      { id: "clients", name: "Clïents" },
    ]);
    expect(filterPaletteWorkspaces(workspaces, "")).toEqual(workspaces);
  });

  it("toggles between a clean open palette and the reset closed state", () => {
    let state = commandPaletteReducer(createInitialCommandPaletteState(), { type: "toggle" });
    expect(state).toMatchObject({ open: true, query: "", scope: "all" });
    state = commandPaletteReducer(state, { type: "set-query", query: "meeting" });
    state = commandPaletteReducer(state, { type: "toggle" });
    expect(state).toEqual(createInitialCommandPaletteState());
  });

  it("preserves capture input after a failed submission and resets scope when closed", () => {
    let state = createInitialCommandPaletteState();
    state = commandPaletteReducer(state, { type: "open" });
    state = commandPaletteReducer(state, { type: "set-scope", scope: "workspace" });
    state = commandPaletteReducer(state, { type: "enter-capture" });
    state = commandPaletteReducer(state, { type: "set-capture-title", title: "Keep this" });
    state = commandPaletteReducer(state, { type: "capture-failed" });

    expect(state.captureTitle).toBe("Keep this");

    state = commandPaletteReducer(state, { type: "close" });
    expect(state).toEqual(createInitialCommandPaletteState());
  });

  it("uses six recent items and applies only the explicit workspace scope", () => {
    expect(RECENT_PALETTE_LIMIT).toBe(6);
    expect(getPaletteWorkspaceScope("all", "client")).toBeUndefined();
    expect(getPaletteWorkspaceScope("workspace", "client")).toBe("client");
    expect(getPaletteWorkspaceScope("workspace", null)).toBeUndefined();
  });
});
