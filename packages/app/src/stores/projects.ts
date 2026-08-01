import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProjectStatus, ProjectUpdate } from "@desk/core/types";
import { getDeskService } from "@desk/core";
import { writePerWorkspaceAgentFiles } from "@/lib/smart-index/agent-files";
import { contentKeys } from "./content";
import { invalidateDashboardOverview } from "./dashboard";
import {
  composeLegacyProjectHome,
  isUnsupportedDeskOperation,
  legacyProjectsToSummaries,
} from "@/lib/project-service-compat";

/** Regenerate per-workspace agent files when projects change */
function regenerateWorkspaceAgentFiles(workspaceId: string) {
  Promise.all([getDeskService().getWorkspace(workspaceId), getDeskService().getProjects(workspaceId)])
    .then(([ws, projects]) => {
      if (ws) return writePerWorkspaceAgentFiles(workspaceId, ws, projects);
    })
    .catch(() => {});
}

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  byWorkspace: (workspaceId: string) => [...projectKeys.all, "workspace", workspaceId] as const,
  summaries: (workspaceId: string, today: string) =>
    [...projectKeys.byWorkspace(workspaceId), "summaries", today] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.byWorkspace(workspaceId), "detail", projectId] as const,
  home: (workspaceId: string, projectId: string, today: string) =>
    [...projectKeys.byWorkspace(workspaceId), "home", projectId, today] as const,
};

/**
 * Hook to fetch all projects for a workspace
 */
export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: projectKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return getDeskService().getProjects(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

export function useProjectSummaries(workspaceId: string | null, today: string) {
  return useQuery({
    queryKey: projectKeys.summaries(workspaceId || "", today),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      const service = getDeskService();
      try {
        return await service.getProjectSummaries(workspaceId, { today });
      } catch (error) {
        if (!isUnsupportedDeskOperation(error, "getProjectSummaries")) throw error;
        return legacyProjectsToSummaries(await service.getProjects(workspaceId));
      }
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch a single project
 */
export function useProject(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return getDeskService().getProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

export function useProjectHome(
  workspaceId: string | null,
  projectId: string | null,
  today: string,
) {
  return useQuery({
    queryKey: projectKeys.home(workspaceId || "", projectId || "", today),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      const service = getDeskService();
      try {
        return await service.getProjectHome(workspaceId, projectId, { today });
      } catch (error) {
        if (!isUnsupportedDeskOperation(error, "getProjectHome")) throw error;
        const [project, tasks, docs, meetings, workspaceView, projectView] = await Promise.all([
          service.getProject(workspaceId, projectId),
          service.getTasksByProject(workspaceId, projectId),
          service.getDocsByProject(workspaceId, projectId),
          service.getMeetingsByProject(workspaceId, projectId),
          service.getViewState(workspaceId, null),
          service.getViewState(workspaceId, projectId),
        ]);
        if (!project) return null;
        return composeLegacyProjectHome(
          project,
          tasks,
          docs,
          meetings,
          [...(workspaceView.highlightedTasks ?? []), ...(projectView.highlightedTasks ?? [])],
          today,
        );
      }
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      name: string;
      description?: string;
      status?: ProjectStatus;
    }) => getDeskService().createProject(data),
    onSuccess: (newProject) => {
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: projectKeys.byWorkspace(newProject.workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: contentKeys.shell(newProject.workspaceId),
      });
      regenerateWorkspaceAgentFiles(newProject.workspaceId);
    },
  });
}

/**
 * Hook to update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      workspaceId,
      updates,
    }: {
      projectId: string;
      workspaceId: string;
      updates: ProjectUpdate;
    }) =>
      getDeskService().updateProject(projectId, updates, workspaceId).then((project) => {
        if (!project) throw new Error(`Project '${projectId}' no longer exists`);
        return project;
      }),
    onSuccess: (updatedProject, variables) => {
      invalidateDashboardOverview(queryClient);
      if (updatedProject) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(variables.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.shell(variables.workspaceId),
        });
        regenerateWorkspaceAgentFiles(variables.workspaceId);
      }
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, workspaceId }: { projectId: string; workspaceId: string }) =>
      getDeskService().deleteProject(projectId, workspaceId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      invalidateDashboardOverview(queryClient);
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(result.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.shell(result.workspaceId),
        });
        regenerateWorkspaceAgentFiles(result.workspaceId);
      }
    },
  });
}
