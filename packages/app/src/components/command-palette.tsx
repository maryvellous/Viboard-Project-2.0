import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronsUpDown,
  Circle,
  Clock,
  FileText,
  FolderKanban,
  Home,
  Keyboard,
  Settings,
  Zap,
} from "lucide-react";
import {
  getRecentItems,
  getScopedEntityKey,
  isMacOS,
  search,
  type SearchItemType,
  type SearchResult,
} from "@desk/core";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineProgress } from "@/components/ui/inline-progress";
import { Input } from "@/components/ui/input";
import { AIBadge } from "@/components/ui/ai-badge";
import { useSearchIndexState } from "@/hooks/use-search-index";
import { searchIndexController } from "@/lib/search-index-controller";
import { buildSearchSnippet, splitHighlightedText } from "@/lib/search-presentation";
import { openPaletteRoute, openSearchProject } from "@/lib/search-navigation";
import { confirmUnsavedChanges } from "@/lib/unsaved-changes-guard";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  buildPaletteCommands,
  commandPaletteReducer,
  createInitialCommandPaletteState,
  filterPaletteWorkspaces,
  getDefaultPaletteCommands,
  getPaletteWorkspaceScope,
  handlePaletteEscape,
  matchPaletteCommands,
  RECENT_PALETTE_LIMIT,
  type PaletteCommand,
  type PaletteCommandIcon,
  type PaletteModal,
} from "@/lib/command-palette-model";
import {
  getKeyboardShortcutLabel,
  matchesKeyboardShortcut,
} from "@/lib/keyboard-shortcuts";
import { useNavigationStore } from "@/stores/navigation";
import { useCreateCaptureTask } from "@/stores/personal";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { useOpenTab } from "@/stores/tabs";
import { useCurrentWorkspace, useWorkspaces } from "@/stores/workspaces";
import { useProjects } from "@/stores/projects";
import type { Workspace } from "@desk/core/types";
import { toast } from "sonner";

const OPEN_COMMAND_PALETTE_EVENT = "desk:open-command-palette";

const NewTaskModal = lazy(() => import("@/components/tasks/new-task-modal").then((module) => ({ default: module.NewTaskModal })));
const NewDocModal = lazy(() => import("@/components/docs/new-doc-modal").then((module) => ({ default: module.NewDocModal })));
const NewMeetingModal = lazy(() => import("@/components/meetings/new-meeting-modal").then((module) => ({ default: module.NewMeetingModal })));
const NewProjectModal = lazy(() => import("@/components/projects/new-project-modal").then((module) => ({ default: module.NewProjectModal })));

const TYPE_ICONS: Record<SearchItemType, React.ReactNode> = {
  task: <CheckSquare className="size-4" />,
  doc: <FileText className="size-4" />,
  meeting: <Calendar className="size-4" />,
  project: <FolderKanban className="size-4" />,
};

const COMMAND_ICONS: Record<PaletteCommandIcon, React.ReactNode> = {
  capture: <Zap className="size-4" />,
  task: <CheckSquare className="size-4" />,
  doc: <FileText className="size-4" />,
  meeting: <Calendar className="size-4" />,
  project: <FolderKanban className="size-4" />,
  workspace: <ChevronsUpDown className="size-4" />,
  dashboard: <Home className="size-4" />,
  planner: <CalendarDays className="size-4" />,
  settings: <Settings className="size-4" />,
  shortcuts: <Keyboard className="size-4" />,
};

const TYPE_LABEL_KEYS: Record<SearchItemType, string> = {
  task: "search.globalSearch.types.task",
  doc: "search.globalSearch.types.doc",
  meeting: "search.globalSearch.types.meeting",
  project: "search.globalSearch.types.project",
};

export function openCommandPalette() {
  document.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(
    commandPaletteReducer,
    undefined,
    createInitialCommandPaletteState,
  );
  const [activeModal, setActiveModal] = useState<PaletteModal | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const currentWorkspaceId = useNavigationStore((value) => value.currentWorkspaceId);
  const setCurrentWorkspaceId = useNavigationStore((value) => value.setCurrentWorkspaceId);
  const currentWorkspace = useCurrentWorkspace();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects(currentWorkspaceId);
  const indexState = useSearchIndexState();
  const createCaptureTask = useCreateCaptureTask();
  const { openTask, openDoc, openMeeting, openDesk } = useOpenTab();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesKeyboardShortcut(event, "palette")) return;
      event.preventDefault();
      dispatch({ type: "toggle" });
    };
    const handleOpen = () => dispatch({ type: "open" });
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    if (state.open) void searchIndexController.refresh();
  }, [state.open]);

  const workspaceId = getPaletteWorkspaceScope(state.scope, currentWorkspaceId);
  const query = state.query.trim();
  const results = useMemo(() => {
    // Search data lives in the module-level index; its revision is the recompute signal.
    void indexState.revision;
    if (!indexState.hasUsableIndex) return [];
    return query
      ? search(query, { limit: 10, workspaceId })
      : getRecentItems(RECENT_PALETTE_LIMIT, undefined, workspaceId);
  }, [indexState.hasUsableIndex, indexState.revision, query, workspaceId]);

  const commands = useMemo(
    () => buildPaletteCommands(t, {
      hasWorkspace: Boolean(currentWorkspace),
      hasProjects: projects.length > 0,
    }),
    [currentWorkspace, projects.length, t],
  );
  const shownCommands = query
    ? matchPaletteCommands(commands, query)
    : getDefaultPaletteCommands(commands);
  const shownWorkspaces = useMemo(
    () => filterPaletteWorkspaces(workspaces, state.query),
    [state.query, workspaces],
  );

  const openModalAfterPalette = useCallback((modal: PaletteModal) => {
    dispatch({ type: "close" });
    window.setTimeout(() => setActiveModal(modal), 0);
  }, []);

  const handleCommand = useCallback((command: PaletteCommand) => {
    if (command.disabled) return;
    switch (command.action.kind) {
      case "capture":
        dispatch({ type: "enter-capture" });
        return;
      case "modal":
        openModalAfterPalette(command.action.modal);
        return;
      case "workspaces":
        dispatch({ type: "enter-workspaces" });
        return;
      case "navigate": {
        const opened = openPaletteRoute(command.action.path, {
          confirmUnsavedChanges,
          beforeNavigate: command.action.path === "/projects"
            ? () => useProjectSelectionStore.setState({ selectedProjectId: null })
            : undefined,
          activateDesk: openDesk,
          navigate,
        });
        if (opened) dispatch({ type: "close" });
        return;
      }
      case "shortcuts":
        dispatch({ type: "close" });
        window.setTimeout(() => setShortcutsOpen(true), 0);
    }
  }, [navigate, openDesk, openModalAfterPalette]);

  const handleResult = useCallback((result: SearchResult) => {
    const { item } = result;
    switch (item.type) {
      case "task":
        dispatch({ type: "close" });
        openTask(item);
        break;
      case "doc":
        dispatch({ type: "close" });
        openDoc(item);
        break;
      case "meeting":
        dispatch({ type: "close" });
        openMeeting(item);
        break;
      case "project": {
        const opened = openSearchProject(item, {
          currentWorkspaceId,
          setCurrentWorkspaceId,
          getCurrentWorkspaceId: () => useNavigationStore.getState().currentWorkspaceId,
          confirmUnsavedChanges,
          activateDesk: openDesk,
          navigate,
        });
        if (opened) dispatch({ type: "close" });
        break;
      }
    }
  }, [currentWorkspaceId, navigate, openDesk, openDoc, openMeeting, openTask, setCurrentWorkspaceId]);

  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    if (useNavigationStore.getState().currentWorkspaceId === workspaceId) {
      dispatch({ type: "close" });
    }
  }, [setCurrentWorkspaceId]);

  const handleCaptureSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = state.captureTitle.trim();
    if (!title || createCaptureTask.isPending) return;

    try {
      await createCaptureTask.mutateAsync({ title });
      dispatch({ type: "capture-succeeded" });
      toast.success(t("search.commandPalette.capture.success"));
    } catch (error) {
      console.error("Failed to capture task:", error);
      dispatch({ type: "capture-failed" });
      toast.error(t("search.commandPalette.capture.error"));
    }
  };

  const contentStatus = !indexState.hasUsableIndex
    ? indexState.status === "error"
      ? t("search.globalSearch.unavailable")
      : t("search.globalSearch.buildingIndex")
    : query && results.length === 0 && shownCommands.length === 0
      ? t("search.globalSearch.noResults")
      : null;

  return (
    <>
      <CommandDialog
        open={state.open}
        onOpenChange={(open) => dispatch({ type: open ? "open" : "close" })}
        onEscapeKeyDown={(event) => handlePaletteEscape(
          state.view,
          event,
          dispatch,
          state.view !== "capture" || !createCaptureTask.isPending,
        )}
        shouldFilter={false}
      >
        {state.view === "capture" ? (
          <CaptureTaskView
            title={state.captureTitle}
            pending={createCaptureTask.isPending}
            onTitleChange={(title) => dispatch({ type: "set-capture-title", title })}
            onBack={() => dispatch({ type: "leave-capture" })}
            onSubmit={handleCaptureSubmit}
          />
        ) : state.view === "workspaces" ? (
          <WorkspacePickerView
            query={state.query}
            workspaces={shownWorkspaces}
            currentWorkspaceId={currentWorkspaceId}
            onQueryChange={(query) => dispatch({ type: "set-query", query })}
            onBack={() => dispatch({ type: "leave-workspaces" })}
            onSelect={handleWorkspaceSelect}
          />
        ) : (
          <>
            <CommandInput
              placeholder={t("search.commandPalette.placeholder")}
              value={state.query}
              onValueChange={(value) => dispatch({ type: "set-query", query: value })}
            />
            <ScopeToggle
              scope={state.scope}
              hasWorkspace={Boolean(currentWorkspaceId)}
              onChange={(scope) => dispatch({ type: "set-scope", scope })}
            />
            <CommandList>
              {shownCommands.length > 0 && (
                <CommandGroup heading={query
                  ? t("search.commandPalette.actionsHeading")
                  : t("search.commandPalette.quickActionsHeading")}
                >
                  {shownCommands.map((command) => (
                    <PaletteCommandItem
                      key={command.id}
                      command={command}
                      onSelect={handleCommand}
                    />
                  ))}
                </CommandGroup>
              )}
              {results.length > 0 && (
                <CommandGroup heading={query
                  ? t("search.globalSearch.resultsHeading")
                  : t("search.globalSearch.recentHeading")}
                >
                  {results.map((result) => (
                    <SearchResultItem
                      key={`${result.item.type}-${getScopedEntityKey(result.item)}`}
                      result={result}
                      onSelect={handleResult}
                    />
                  ))}
                </CommandGroup>
              )}
              {contentStatus && (
                <div role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {contentStatus}
                </div>
              )}
            </CommandList>
            <PaletteFooter />
          </>
        )}
      </CommandDialog>

      {activeModal && (
        <Suspense fallback={null}>
          {activeModal === "task" && <NewTaskModal open onClose={() => setActiveModal(null)} />}
          {activeModal === "doc" && <NewDocModal open onClose={() => setActiveModal(null)} />}
          {activeModal === "meeting" && <NewMeetingModal open onClose={() => setActiveModal(null)} />}
          {activeModal === "project" && <NewProjectModal open onClose={() => setActiveModal(null)} />}
        </Suspense>
      )}
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}

function WorkspacePickerView({
  query,
  workspaces,
  currentWorkspaceId,
  onQueryChange,
  onBack,
  onSelect,
}: {
  query: string;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onSelect: (workspaceId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onBack}
          aria-label={t("search.commandPalette.workspaces.back")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="text-sm font-medium">
          {t("search.commandPalette.commands.switchWorkspace.label")}
        </div>
      </div>
      <CommandInput
        placeholder={t("search.commandPalette.workspaces.placeholder")}
        value={query}
        onValueChange={onQueryChange}
        autoFocus
      />
      <CommandList>
        {workspaces.length > 0 ? (
          <CommandGroup heading={t("search.commandPalette.workspaces.heading")}>
            {workspaces.map((workspace) => {
              const current = workspace.id === currentWorkspaceId;
              return (
                <CommandItem
                  key={workspace.id}
                  value={`workspace-${workspace.id}-${workspace.name}`}
                  onSelect={() => onSelect(workspace.id)}
                  className="gap-3 py-2"
                >
                  <Circle
                    className="size-3.5 shrink-0"
                    style={{ color: workspace.color, fill: workspace.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                  {current && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {t("search.commandPalette.workspaces.current")}
                      <Check className="size-3.5" />
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : (
          <div role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("search.commandPalette.workspaces.noResults")}
          </div>
        )}
      </CommandList>
      <div className="flex justify-end border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>{t("search.commandPalette.footer.escapeBack")}</span>
      </div>
    </div>
  );
}

function ScopeToggle({
  scope,
  hasWorkspace,
  onChange,
}: {
  scope: "all" | "workspace";
  hasWorkspace: boolean;
  onChange: (scope: "all" | "workspace") => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("search.globalSearch.scope.label")}
      className="flex items-center gap-1 border-b px-3 py-2"
    >
      {(["all", "workspace"] as const).map((value) => (
        <button
          key={value}
          type="button"
          disabled={value === "workspace" && !hasWorkspace}
          aria-pressed={scope === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            scope === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {t(`search.globalSearch.scope.${value}`)}
        </button>
      ))}
    </div>
  );
}

function PaletteCommandItem({
  command,
  onSelect,
}: {
  command: PaletteCommand;
  onSelect: (command: PaletteCommand) => void;
}) {
  return (
    <CommandItem
      value={`command-${command.id}-${command.label}-${command.aliases.join("-")}`}
      disabled={command.disabled}
      onSelect={() => onSelect(command)}
      className="gap-3 py-2"
    >
      <span className="text-muted-foreground">{COMMAND_ICONS[command.icon]}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{command.label}</span>
        {command.disabledReason && (
          <span className="block truncate text-xs text-muted-foreground">{command.disabledReason}</span>
        )}
      </span>
    </CommandItem>
  );
}

function CaptureTaskView({
  title,
  pending,
  onTitleChange,
  onBack,
  onSubmit,
}: {
  title: string;
  pending: boolean;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onBack}
          disabled={pending}
          aria-label={t("search.commandPalette.capture.back")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="text-sm font-medium">{t("search.commandPalette.capture.title")}</div>
          <div className="text-xs text-muted-foreground">{t("search.commandPalette.capture.description")}</div>
        </div>
      </div>
      <form onSubmit={onSubmit} className="p-3">
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t("search.commandPalette.capture.placeholder")}
            disabled={pending}
            autoFocus
          />
          <Button type="submit" disabled={!title.trim() || pending}>
            {pending ? <InlineProgress /> : t("search.commandPalette.capture.submit")}
          </Button>
        </div>
      </form>
      <div className="flex justify-end gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>{t("search.commandPalette.footer.enterCapture")}</span>
        <span>{t("search.commandPalette.footer.escapeBack")}</span>
      </div>
    </div>
  );
}

function PaletteFooter() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
      <span>{t("search.commandPalette.footer.navigate")}</span>
      <span>{t("search.commandPalette.footer.open")}</span>
      <span>{t("search.commandPalette.footer.close")}</span>
    </div>
  );
}

function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const mac = isMacOS();
  const rows = [
    { label: t("search.commandPalette.shortcuts.palette"), value: getKeyboardShortcutLabel("palette", mac) },
    { label: t("search.commandPalette.shortcuts.save"), value: getKeyboardShortcutLabel("save", mac) },
    { label: t("search.commandPalette.shortcuts.closeTab"), value: getKeyboardShortcutLabel("close-tab", mac) },
    {
      label: t("search.commandPalette.shortcuts.switchTabs"),
      value: `${getKeyboardShortcutLabel("previous-tab", mac)} / ${getKeyboardShortcutLabel("next-tab", mac)}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("search.commandPalette.shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("search.commandPalette.shortcuts.description")}</DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-md border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
              <span>{row.label}</span>
              <kbd className="shrink-0 rounded border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                {row.value}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const { item } = result;
  const snippet = buildSearchSnippet(result);
  const titleSegments = useMemo(() => {
    const titleMatch = result.matches?.find((match) => match.key === "title");
    return splitHighlightedText(
      item.title,
      titleMatch?.indices.map(([start, end]) => [start, end + 1]) ?? [],
    );
  }, [item.title, result.matches]);
  const context = [
    item.workspaceName,
    item.type === "project" ? undefined : item.projectName,
    t(TYPE_LABEL_KEYS[item.type]),
  ].filter(Boolean).join(" › ");

  return (
    <CommandItem
      value={`${item.type}-${getScopedEntityKey(item)}-${item.title}`}
      onSelect={() => onSelect(result)}
      className="flex items-start gap-3 py-2"
    >
      <span className="mt-0.5 text-muted-foreground">{TYPE_ICONS[item.type]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {titleSegments.map((segment, index) => segment.highlighted ? (
              <mark key={index} className="bg-transparent font-semibold text-foreground">{segment.text}</mark>
            ) : segment.text)}
          </span>
          {item.author === "ai" && <AIBadge />}
          {item.status && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {item.status}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{context}</div>
        {snippet && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
            {snippet.segments.map((segment, index) => segment.highlighted ? (
              <mark key={index} className="bg-transparent font-semibold text-foreground/80">{segment.text}</mark>
            ) : segment.text)}
          </div>
        )}
      </div>
      {item.due && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {formatDate(item.due)}
        </span>
      )}
    </CommandItem>
  );
}

export default CommandPalette;
