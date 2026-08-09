import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EntityOverview } from "@/components/entity-overview";
import { Button } from "@/components/ui/button";
import { ProjectHomeHeader } from "@/components/projects/project-home-header";
import {
  CurrentWorkSection,
  ProjectTimelineRail,
} from "@/components/projects/project-home-sections";
import { useProjectHome, useUpdateProject, useDeleteProject } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import type { ProjectUpdate } from "@desk/core/types";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { pageLayoutClasses, pageWidthClasses } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

interface ProjectHomeProps {
  workspaceId: string;
  projectId: string;
}

/** Calm project room: orientation, current work, and a factual schedule/history rail. */
export function ProjectHome({ workspaceId, projectId }: ProjectHomeProps) {
  const { t } = useTranslation();
  const { today } = useMinuteClock();
  const {
    data: home,
    isLoading,
    isError,
    refetch,
  } = useProjectHome(workspaceId, projectId, today);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const setSelectedProject = useProjectSelectionStore((state) => state.setSelectedProject);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleUpdate = async (updates: ProjectUpdate) => {
    try {
      await updateProject.mutateAsync({ projectId, workspaceId, updates });
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error(t("toasts.project.update.error"));
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync({ projectId, workspaceId });
      setSelectedProject(null);
      toast.success(t("toasts.project.delete.success"));
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error(t("toasts.project.delete.error"));
    }
  };

  if (isLoading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (isError) {
    return (
      <StatePanel
        variant="error"
        title={t("pages.projects.home.loadErrorTitle")}
        description={t("pages.projects.home.loadErrorDescription")}
        action={<Button variant="outline" size="sm" onClick={() => void refetch()}>{t("common.buttons.retry")}</Button>}
        className="h-full"
      />
    );
  }

  if (!home) {
    return (
      <StatePanel
        variant="notFound"
        icon={FolderKanban}
        title={t("pages.projects.home.notFoundTitle")}
        description={t("pages.projects.home.notFoundDescription")}
        className="h-full"
      />
    );
  }

  const { project, currentTasks, timeline, lastActivityAt } = home;

  return (
    <>
      <ScrollArea className="h-full">
        <div
          className={cn(
            "mx-auto w-full space-y-7 py-5 md:py-6",
            pageWidthClasses.wide,
            pageLayoutClasses.horizontalPadding,
          )}
        >
          <ProjectHomeHeader
            key={`${workspaceId}:${projectId}:header`}
            project={project}
            onUpdate={handleUpdate}
            onDeleteRequest={() => setConfirmDelete(true)}
            lastActivityAt={lastActivityAt}
          />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
            <main className="min-w-0 space-y-9">
              <EntityOverview
                key={`${workspaceId}:${projectId}:overview`}
                title={t("pages.projects.home.overview.title")}
                value={project.overview ?? ""}
                placeholder={t("pages.projects.home.overview.placeholder")}
                documentRef={{ kind: "project-overview", workspaceId, projectId }}
                collapsedClassName="max-h-72"
                resetKey={`${workspaceId}:${projectId}`}
              />
              <CurrentWorkSection
                key={`${workspaceId}:${projectId}:current-work`}
                workspaceId={workspaceId}
                projectId={projectId}
                tasks={currentTasks}
              />
            </main>
            <ProjectTimelineRail key={`${workspaceId}:${projectId}`} timeline={timeline} />
          </div>
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("pages.projects.deleteConfirmTitle")}
        description={t("pages.projects.deleteConfirmDescription", { name: project.name })}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
