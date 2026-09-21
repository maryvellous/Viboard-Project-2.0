/**
 * Capture triage — a COMPACT strip, not a post-it and not a page block.
 *
 * Semantics: a post-it in Diaspro means "a small task note", so the triage inbox
 * must not be dressed as one. This renders nothing at all when the inbox is empty
 * (no giant empty container) and a single slim bar when it holds items, expanding
 * in place into the compact triage list.
 *
 * Creation lives in QuickAddTask (NewTaskModal → useCreateTask); this file only
 * moves and deletes already-captured items.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  MoreHorizontal,
  User,
  FolderKanban,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCaptureTasks,
  useMoveCaptureToPersonal,
  useMoveCaptureToWorkspace,
  useDeleteCaptureTask,
  useWorkspaces,
  useProjects,
} from "@/stores";
import type { Task, Workspace } from "@desk/core/types";
import { SPECIAL_DIRS } from "@desk/core";

interface CaptureWidgetProps {
  onTriageComplete?: (task: Task, destination: TriageDestination) => void;
}

export interface TriageDestination {
  type: "personal" | "workspace";
  workspaceId?: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
}

export function CaptureWidget({ onTriageComplete }: CaptureWidgetProps) {
  const { t } = useTranslation();
  const { data: tasks = [] } = useCaptureTasks();
  const { data: workspaces = [] } = useWorkspaces();
  const moveToPersonal = useMoveCaptureToPersonal();
  const moveToWorkspace = useMoveCaptureToWorkspace();
  const deleteTask = useDeleteCaptureTask();

  const [expanded, setExpanded] = useState(false);

  const homeWorkspace = workspaces.find((w) => w.isHome);
  const homeName = homeWorkspace?.name ?? t("pages.dashboard.capture.defaultHomeName");
  const otherWorkspaces = workspaces.filter((w) => !w.isHome);

  const handleMoveToPersonal = async (task: Task) => {
    await moveToPersonal.mutateAsync(task.id);
    onTriageComplete?.(task, {
      type: "personal",
      workspaceId: homeWorkspace?.id,
      workspaceName: homeName,
    });
  };

  const handleMoveToWorkspace = async (
    task: Task,
    workspace: Workspace,
    projectId: string,
    projectName: string
  ) => {
    await moveToWorkspace.mutateAsync({
      taskId: task.id,
      workspaceId: workspace.id,
      projectId,
    });
    onTriageComplete?.(task, {
      type: "workspace",
      workspaceId: workspace.id,
      projectId,
      workspaceName: workspace.name,
      projectName,
    });
  };

  // Empty inbox → no container at all. The strip is an affordance, not a section.
  if (tasks.length === 0) return null;

  return (
    <section className="diaspro-triage" aria-label={t("pages.dashboard.capture.title")}>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <Inbox className="size-4 shrink-0 text-[#a5c4dc]" />
        <span className="text-sm font-semibold text-foreground">
          {t("pages.dashboard.capture.title")}
        </span>
        <span className="diaspro-chip diaspro-chip--terracotta">
          {t("pages.dashboard.capture.toTriageCount", { count: tasks.length })}
        </span>
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1.5 px-3 pb-3">
          {tasks.map((task) => (
            <CaptureItem
              key={task.id}
              task={task}
              workspaces={otherWorkspaces}
              homeName={homeName}
              onMoveToPersonal={() => void handleMoveToPersonal(task)}
              onMoveToWorkspace={(ws, pid, pname) =>
                void handleMoveToWorkspace(task, ws, pid, pname)
              }
              onDelete={() => void deleteTask.mutateAsync(task.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface CaptureItemProps {
  task: Task;
  workspaces: Workspace[];
  homeName: string;
  onMoveToPersonal: () => void;
  onMoveToWorkspace: (workspace: Workspace, projectId: string, projectName: string) => void;
  onDelete: () => void;
}

function CaptureItem({
  task,
  workspaces,
  homeName,
  onMoveToPersonal,
  onMoveToWorkspace,
  onDelete,
}: CaptureItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-1.5">
      <span className="flex-1 truncate text-sm font-medium">{task.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold">
            {t("pages.dashboard.capture.triageButton")}
            <MoreHorizontal className="size-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Home workspace tasks */}
          <DropdownMenuItem onClick={onMoveToPersonal}>
            <User className="size-4 mr-2" />
            {t("pages.dashboard.capture.moveToHomeTasks", { home: homeName })}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Workspaces */}
          {workspaces.length > 0 ? (
            workspaces.map((workspace) => (
              <WorkspaceSubmenu
                key={workspace.id}
                workspace={workspace}
                onSelect={(projectId, projectName) =>
                  onMoveToWorkspace(workspace, projectId, projectName)
                }
              />
            ))
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground">
              {t("pages.dashboard.capture.noWorkspacesYet")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
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
  );
}

interface WorkspaceSubmenuProps {
  workspace: Workspace;
  onSelect: (projectId: string, projectName: string) => void;
}

function WorkspaceSubmenu({ workspace, onSelect }: WorkspaceSubmenuProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects(workspace.id);
  const unassignedLabel = t("pages.dashboard.capture.unassigned");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderKanban className="size-4 mr-2" />
        {workspace.name}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        {/* Unassigned option */}
        <DropdownMenuItem
          onClick={() => onSelect(SPECIAL_DIRS.UNASSIGNED, unassignedLabel)}
        >
          {unassignedLabel}
        </DropdownMenuItem>

        {projects.length > 0 && <DropdownMenuSeparator />}

        {/* Projects */}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => onSelect(project.id, project.name)}
          >
            {project.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
