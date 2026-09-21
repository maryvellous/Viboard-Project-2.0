import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  CheckSquare,
  FolderKanban,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { FilteredListPage } from "@/components/patterns";
import { EntityOverview } from "@/components/entity-overview";
import { MiniTaskPostit } from "@/components/projects/mini-task-postit";
import { cn } from "@/lib/utils";
import { projectStatusDotColors, projectStatuses } from "@/lib/design-tokens";
import { countActiveTasks } from "@/lib/task-status";
import { isOverdue } from "@/lib/format";
import type { Project } from "@desk/core/types";
import type { ProjectSummary } from "@desk/core";
import {
  useProjectSummaries,
  useProjectTasks,
  useDeleteProject,
  useCurrentWorkspace,
  useOpenTab,
} from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { NewProjectModal } from "./new-project-modal";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatLocaleDate, formatRelativeTime } from "@/lib/i18n/format";
import {
  filterAndSortProjects,
  projectCardVariant,
  type ProjectSortOrder,
} from "@/lib/project-browse";
import { pageWidthClasses } from "@/lib/enterprise-ui";

const ALL_STATUSES = "all";
const SORT_RECENT = "recent";
const SORT_NAME = "name";

interface ProjectsBrowseProps {
  workspaceId: string;
}

/**
 * Full-width "All projects" view shown at /projects when no project is
 * selected. Search + status filter + New Project; clicking a row selects the
 * project, which swaps this view for its ProjectHome.
 */
export function ProjectsBrowse({ workspaceId }: ProjectsBrowseProps) {
  const { t } = useTranslation();
  const { today } = useMinuteClock();
  const { data: projects = [] } = useProjectSummaries(workspaceId, today);
  const workspace = useCurrentWorkspace();
  const deleteProject = useDeleteProject();
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [sortOrder, setSortOrder] = useState<string>(SORT_RECENT);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchQuery("");
    setStatusFilter(ALL_STATUSES);
    setSortOrder(SORT_RECENT);
  }, [workspaceId]);

  const filtered = useMemo(() => {
    return filterAndSortProjects(projects, {
      query: searchQuery,
      status: statusFilter,
      sort: sortOrder as ProjectSortOrder,
    });
  }, [projects, searchQuery, sortOrder, statusFilter]);

  const handleDelete = useCallback(async () => {
    if (!deletingProject) return;
    try {
      await deleteProject.mutateAsync({
        projectId: deletingProject.id,
        workspaceId: deletingProject.workspaceId,
      });
      toast.success(t("toasts.project.delete.success"));
      setDeletingProject(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error(t("toasts.project.delete.error"));
    }
  }, [deletingProject, deleteProject, t]);

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== ALL_STATUSES;

  const searchControl = (
    <div className="relative w-full min-w-52 sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={searchInputRef}
        type="text"
        placeholder={t("pages.projects.browse.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setSearchQuery("");
        }}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setSearchQuery("");
            searchInputRef.current?.focus();
          }}
          aria-label={t("common.buttons.clear")}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <FilteredListPage
      title={t("nav.sidebar.projectsSection")}
      icon={FolderKanban}
      accent="sand"
      actionLabel={t("pages.projects.browse.newProject")}
      onAction={() => setNewProjectOpen(true)}
      filters={[
        {
          id: "status",
          label: t("pages.projects.browse.statusLabel"),
          value: statusFilter,
          onChange: setStatusFilter,
          options: projectStatuses.map((value) => ({
            value,
            label: t(`entities.project.status.${value}`),
          })),
          allLabel: t("pages.projects.browse.allStatuses"),
          width: "w-[160px]",
        },
        {
          id: "sort",
          label: t("pages.projects.browse.sortLabel"),
          value: sortOrder,
          onChange: setSortOrder,
          options: [
            { value: SORT_RECENT, label: t("pages.projects.browse.sortRecent") },
            { value: SORT_NAME, label: t("pages.projects.browse.sortName") },
          ],
          width: "w-[170px]",
        },
      ]}
      count={filtered.length}
      countLabel={t("pages.projects.browse.countLabel")}
      filterLeading={searchControl}
      modal={
        <>
          <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
          <ConfirmDialog
            open={!!deletingProject}
            onOpenChange={(open) => !open && setDeletingProject(null)}
            title={t("pages.projects.deleteConfirmTitle")}
            description={t("pages.projects.deleteConfirmDescription", {
              name: deletingProject?.name ?? "",
            })}
            confirmLabel={t("common.buttons.delete")}
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      }
    >
      <div className={cn("mx-auto", pageWidthClasses.reading)}>
        {workspace?.id === workspaceId && (
          <div className="mb-6 border-b border-border/60 pb-5">
            <EntityOverview
              key={workspaceId}
              title={t("pages.projects.browse.workspaceOverview.title")}
              value={workspace.overview ?? ""}
              placeholder={t("pages.projects.browse.workspaceOverview.placeholder")}
              documentRef={{ kind: "workspace-overview", workspaceId }}
              collapsedClassName="max-h-28"
              resetKey={workspaceId}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <StatePanel
            variant="empty"
            display="inline"
            className="py-12"
            title={
              isFiltering
                ? t("emptyStates.projects.noMatches")
                : t("emptyStates.projects.noProjects")
            }
          />
        ) : (
          <div className="diaspro-project-grid">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => setSelectedProject(project.id)}
                onDelete={() => setDeletingProject(project)}
              />
            ))}
          </div>
        )}
      </div>
    </FilteredListPage>
  );
}

/**
 * A project as a Diaspro card.
 *
 * Colour is stable (derived from the project id, see `projectCardVariant`) and NEVER
 * changes on hover — hover only lifts the card and deepens its shadow, matching
 * `diaspro-ui/cards/cards.css`. Content stays deliberately light: name, status,
 * description, recent activity, task count, and up to three task post-its.
 */
function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { openTask } = useOpenTab();
  const variant = projectCardVariant(project.id);
  const activeTasks = countActiveTasks(project.tasksByStatus);
  // One query per visible card, through the existing store — no data-model change.
  const { data: tasks = [] } = useProjectTasks(project.workspaceId, project.id);
  const postits = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done")
        .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
        .slice(0, 3),
    [tasks],
  );
  const nextDue = postits.find((task) => task.due)?.due;

  return (
    <article className={cn("diaspro-project-card", `diaspro-card--${variant}`)}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          <span className="block truncate font-[Outfit] text-lg font-black leading-tight">
            {project.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold opacity-75">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", projectStatusDotColors[project.status])} />
              {t(`entities.project.status.${project.status}`)}
            </span>
            {activeTasks > 0 && (
              <span className="inline-flex items-center gap-1">
                <CheckSquare className="size-3" />
                {t("pages.projects.browse.activeTasks", { count: activeTasks })}
              </span>
            )}
            {project.lastActivityAt && <span>{formatRelativeTime(project.lastActivityAt)}</span>}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 opacity-60 hover:bg-black/10 hover:opacity-100"
              aria-label={t("common.buttons.delete")}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              {t("common.buttons.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-70">
          {project.description}
        </p>
      )}

      {nextDue && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <CalendarClock className="size-3" />
          {t("pages.projects.browse.nextDue", {
            date: formatLocaleDate(nextDue, { day: "numeric", month: "short" }),
          })}
        </p>
      )}

      {postits.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {postits.map((task) => (
            <MiniTaskPostit
              key={task.id}
              id={task.id}
              title={task.title}
              status={task.status}
              meta={task.due ? formatLocaleDate(task.due, { day: "numeric", month: "short" }) : undefined}
              metaTone={task.due && isOverdue(task.due) ? "terracotta" : "default"}
              onClick={() => openTask(task)}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-black/10 pt-3">
        <button type="button" className="diaspro-pill diaspro-pill--sand" onClick={onOpen}>
          {t("pages.projects.browse.openProject")}
        </button>
      </div>
    </article>
  );
}
