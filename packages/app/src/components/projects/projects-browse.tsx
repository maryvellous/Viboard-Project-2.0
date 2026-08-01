import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, FolderKanban, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { FilteredListPage, ListRow } from "@/components/patterns";
import { EntityOverview } from "@/components/entity-overview";
import { cn } from "@/lib/utils";
import { projectStatusDotColors, projectStatuses } from "@/lib/design-tokens";
import { countActiveTasks } from "@/lib/task-status";
import type { Project } from "@desk/core/types";
import { useProjectSummaries, useDeleteProject, useCurrentWorkspace, useUpdateWorkspace } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { NewProjectModal } from "./new-project-modal";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatRelativeTime } from "@/lib/i18n/format";
import { filterAndSortProjects, type ProjectSortOrder } from "@/lib/project-browse";
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
  const updateWorkspace = useUpdateWorkspace();
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
              onSave={async (overview) => {
                await updateWorkspace.mutateAsync({
                  workspaceId,
                  updates: { overview },
                });
              }}
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
          <div className="-mx-4">
            {filtered.map((project) => {
              const activeTasks = countActiveTasks(project.tasksByStatus);
              return (
                <ListRow
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className="py-2"
                  leading={
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        projectStatusDotColors[project.status],
                        project.description && "mt-2",
                      )}
                      title={t(`entities.project.status.${project.status}`)}
                    />
                  }
                  title={project.name}
                  meta={
                    <>
                      {activeTasks > 0 && (
                        <>
                          <CheckSquare className="size-3" />
                          {t("pages.projects.browse.activeTasks", { count: activeTasks })}
                        </>
                      )}
                      {project.lastActivityAt && (
                        <span>{formatRelativeTime(project.lastActivityAt)}</span>
                      )}
                    </>
                  }
                  secondLine={project.description || undefined}
                  menuItems={
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProject(project);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4 mr-2" />
                      {t("common.buttons.delete")}
                    </DropdownMenuItem>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </FilteredListPage>
  );
}
