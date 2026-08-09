
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import { useEditorDocumentSession, useEditorTab, useEditorSaveShortcut, useEditorSaveAndClose, useEditorProjectMove, useEditorAIInclusion } from "@/hooks/editor";
import { useInternalLinkHandler } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { EditorPathBar } from "./editor-path-bar";
import { EditorRenderStates } from "./editor-render-states";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { TaskStatus, TaskPriority } from "@desk/core/types";
import { getEntityTabId } from "@/lib/tab-identity";
import { useTabStore } from "@/stores/tabs";
import { cn } from "@/lib/utils";
import { pageWidthClasses } from "@/lib/enterprise-ui";
import { EditorConflictDialog } from "./editor-conflict-dialog";

interface TaskEditorProps {
  taskId: string;
  workspaceId: string;
  projectId: string;
  onClose: () => void;
}

export function TaskEditor({ taskId, workspaceId, projectId, onClose }: TaskEditorProps) {
  const { t } = useTranslation();
  const tabId = getEntityTabId("task", { id: taskId, workspaceId, projectId });
  const handleInternalLinkClick = useInternalLinkHandler();
  const { data: task, isLoading: isLoadingTask } = useTask(workspaceId, projectId, taskId);

  // Mutations
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const moveEntityTabToProject = useTabStore((state) => state.moveEntityTabToProject);
  const { data: projects = [] } = useProjects(workspaceId);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Shared hooks
  const { aiExclusionState, handleAIInclusionChange } = useEditorAIInclusion(
    task?.filePath,
    workspaceId,
    "task"
  );

  const {
    content,
    setContent,
    metadata,
    setMetadata,
    restoreEmptyTitle,
    isLoading: isLoadingContent,
    isDirty: contentDirty,
    saveStatus: contentSaveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acceptPathChange,
    acknowledgeDeleted,
    save,
    retry,
    useExternal: chooseExternal,
    keepDesk,
    cancelConflict,
    discard,
    recover,
    loadError,
    serverVersionMismatch,
    retryLoad,
    recoveryBlocked,
    state: editorState,
  } = useEditorDocumentSession({
    ref: { kind: "task", workspaceId, projectId, id: taskId },
    editorType: "task",
    entityId: taskId,
    sessionKey: tabId,
  });

  const title = typeof metadata.title === "string" ? metadata.title : task?.title ?? "";
  const status = (metadata.status as TaskStatus | undefined) ?? task?.status ?? "todo";
  const priority: TaskPriority | "none" = (metadata.priority as TaskPriority | undefined) ?? "none";
  const due = (metadata.due as string | undefined) ?? "";

  useEffect(() => {
    if (contentSaveStatus === "conflict") setShowConflict(true);
  }, [contentSaveStatus]);

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // Project move
  const { currentProjectId, handleProjectChange } = useEditorProjectMove({
    entity: task,
    save,
    acceptPathChange,
    move: moveTaskToProject.mutateAsync,
    entityLabel: "task",
    onMoved: (newProjectId) => moveEntityTabToProject(tabId, newProjectId),
    buildMoveArgs: (id, ws, from, to) => ({ taskId: id, workspaceId: ws, fromProjectId: from, toProjectId: to }),
  });

  // Defer editor rendering
  useEffect(() => {
    if (task && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [task, isLoadingContent, isEditorReady]);

  const handleTitleChange = useCallback((value: string) => setMetadata("title", value), [setMetadata]);
  const handleStatusChange = useCallback((value: TaskStatus) => setMetadata("status", value, true), [setMetadata]);
  const handlePriorityChange = useCallback(
    (value: TaskPriority | "none") => setMetadata("priority", value === "none" ? null : value, true),
    [setMetadata],
  );
  const handleDueChange = useCallback((value: string) => setMetadata("due", value || null, true), [setMetadata]);

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(tabId, title, isDirty);

  const handleDeleteConfirm = useCallback(async () => {
    if (!task) return;

    try {
      await deleteTask.mutateAsync({
        taskId: task.id,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
      });
      removeTaskFromOrder.mutate({
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      });
      toast.success(t("toasts.editor.taskDeleted"));
      onClose();
    } catch {
      toast.error(t("errors.editor.deleteTaskFailed"));
    }
  }, [task, deleteTask, removeTaskFromOrder, onClose, t]);

  const saveStatus = contentSaveStatus === "error" ? "error" as const : contentSaveStatus === "saving" ? "saving" as const : "idle" as const;

  // Render states (deleted, moved, loading, not found)
  const renderState = EditorRenderStates({
    fileDeleted,
    pathChanged,
    newPath,
    isLoading: isLoadingTask || isLoadingContent || (!!task && !isEditorReady),
    entity: task,
    entityLabel: "task",
    loadError,
    serverVersionMismatch,
    onRetryLoad: retryLoad,
    onClose,
    acknowledgePathChange,
    acknowledgeDeleted,
    isDirty: contentDirty,
    onRecover: recover,
    recoveryBlocked,
    recovering: contentSaveStatus === "saving",
    onDiscard: discard,
  });
  if (renderState) return renderState;

  const metadataProps = {
    status,
    onStatusChange: handleStatusChange,
    priority,
    onPriorityChange: handlePriorityChange,
    date: due,
    onDateChange: handleDueChange,
    // dateLabel acts as a discriminator inside MetadataToolbar
    // (isDue = dateLabel === "Due") — keep as English identifier.
    dateLabel: "Due" as const,
    projectId: currentProjectId,
    onProjectChange: handleProjectChange,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorPathBar filePath={editorState?.confirmed.filePath ?? task?.filePath} />
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        onTitleBlur={restoreEmptyTitle}
        placeholder={t("editors.task.titlePlaceholder")}
        saveStatus={saveStatus}
        onRetry={contentSaveStatus === "error" ? retry : undefined}
        onReview={contentSaveStatus === "conflict" ? () => setShowConflict(true) : undefined}
        onDelete={() => setShowDeleteConfirm(true)}
        authorAI={task?.author === "ai"}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
      />

      {/* Sticky metadata row */}
      <div className="shrink-0">
        <div className={cn("mx-auto px-6", pageWidthClasses.reading)}>
          <MetadataToolbar {...metadataProps} />
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* pt-3 + the editor's own py-1 (4px) = 16px, symmetric with the divider's mt-4 */}
        <div className={cn("mx-auto px-6 pb-6 pt-3", pageWidthClasses.reading)}>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder={t("editors.task.contentPlaceholder")}
            minHeight="400px"
            borderless
            onInternalLinkClick={handleInternalLinkClick}
          />
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("editors.task.deleteTitle")}
        description={t("editors.task.deleteDescription")}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
      <EditorConflictDialog
        open={showConflict && contentSaveStatus === "conflict"}
        onUseExternal={() => { setShowConflict(false); chooseExternal(); }}
        onKeepDesk={() => { setShowConflict(false); keepDesk(); }}
        onCancel={() => { setShowConflict(false); cancelConflict(); }}
      />
    </div>
  );
}
