
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDoc, useDeleteDoc, useProjects } from "@/stores";
import { WORKSPACE_LEVEL_PROJECT_ID, SPECIAL_DIRS } from "@desk/core";
import { useEditorDocumentSession, useEditorTab, useEditorSaveShortcut, useEditorSaveAndClose, useEditorAIInclusion } from "@/hooks/editor";
import { useInternalLinkHandler } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { EditorPathBar } from "./editor-path-bar";
import { EditorRenderStates } from "./editor-render-states";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { getEntityTabId } from "@/lib/tab-identity";
import { cn } from "@/lib/utils";
import { pageWidthClasses } from "@/lib/enterprise-ui";
import { EditorConflictDialog } from "./editor-conflict-dialog";

interface DocEditorProps {
  docId: string;
  workspaceId: string;
  projectId: string;
  onClose: () => void;
}

export function DocEditor({ docId, workspaceId, projectId, onClose }: DocEditorProps) {
  const { t } = useTranslation();
  const tabId = getEntityTabId("doc", { id: docId, workspaceId, projectId });
  const handleInternalLinkClick = useInternalLinkHandler();

  const { data: doc, isLoading: isLoadingDoc } = useDoc(workspaceId, projectId, docId);
  const { data: projects = [] } = useProjects(workspaceId);

  // Mutations
  const deleteDoc = useDeleteDoc();

  // Local state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Shared hooks
  const { aiExclusionState, handleAIInclusionChange } = useEditorAIInclusion(
    doc?.filePath,
    workspaceId,
    "doc"
  );

  const {
    content,
    setContent,
    metadata,
    setMetadata,
    restoreEmptyTitle,
    isLoading: isLoadingContent,
    isDirty: contentDirty,
    saveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
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
    ref: { kind: "document", workspaceId, projectId, id: docId },
    editorType: "doc",
    entityId: docId,
    sessionKey: tabId,
  });
  const title = typeof metadata.title === "string" ? metadata.title : doc?.title ?? "";

  useEffect(() => {
    if (saveStatus === "conflict") setShowConflict(true);
  }, [saveStatus]);

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // A doc's location (project / workspace-level / unassigned) is shown read-only in the
  // metadata row; moving a doc happens in the docs tree (drag-drop or the "Move To" menu),
  // which is folder-aware in a way a flat dropdown can't be.
  const projectLabel = useMemo(() => {
    if (!doc) return undefined;
    if (doc.projectId === WORKSPACE_LEVEL_PROJECT_ID) return t("ui.metadataToolbar.workspaceLevel");
    if (doc.projectId === SPECIAL_DIRS.UNASSIGNED) return t("ui.metadataToolbar.noProject");
    return projects.find((p) => p.id === doc.projectId)?.name ?? t("ui.metadataToolbar.noProject");
  }, [doc, projects, t]);

  // Defer editor rendering
  useEffect(() => {
    if (doc && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [doc, isLoadingContent, isEditorReady]);

  const handleTitleChange = useCallback((newTitle: string) => setMetadata("title", newTitle), [setMetadata]);

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(tabId, title, isDirty);

  const handleDeleteConfirm = useCallback(async () => {
    if (!doc) return;

    try {
      await deleteDoc.mutateAsync(doc);
      toast.success(t("toasts.editor.docDeleted"));
      setShowDeleteConfirm(false);
      onClose();
    } catch {
      toast.error(t("errors.editor.deleteDocFailed"));
    }
  }, [doc, deleteDoc, onClose, t]);

  const headerSaveStatus = saveStatus === "error" ? "error" as const : saveStatus === "saving" ? "saving" as const : "idle" as const;

  // Render states (deleted, moved, loading, not found)
  const renderState = EditorRenderStates({
    fileDeleted,
    pathChanged,
    newPath,
    isLoading: isLoadingDoc || isLoadingContent || (!!doc && !isEditorReady),
    entity: doc,
    entityLabel: "doc",
    loadError,
    serverVersionMismatch,
    onRetryLoad: retryLoad,
    onClose,
    acknowledgePathChange,
    acknowledgeDeleted,
    isDirty: contentDirty,
    onRecover: recover,
    recoveryBlocked,
    recovering: saveStatus === "saving",
    onDiscard: discard,
  });
  if (renderState) return renderState;

  // TypeScript can't narrow through EditorRenderStates — doc is guaranteed non-null here
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorPathBar filePath={editorState?.confirmed.filePath ?? doc.filePath} />
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        onTitleBlur={restoreEmptyTitle}
        placeholder={t("editors.doc.titlePlaceholder")}
        saveStatus={headerSaveStatus}
        onRetry={saveStatus === "error" ? retry : undefined}
        onReview={saveStatus === "conflict" ? () => setShowConflict(true) : undefined}
        onDelete={() => setShowDeleteConfirm(true)}
        authorAI={doc.author === "ai"}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
      />

      {/* Sticky metadata row */}
      <div className="shrink-0">
        <div className={cn("mx-auto px-6", pageWidthClasses.reading)}>
          <MetadataToolbar
            projectId={doc.projectId}
            projectReadOnly
            projectLabel={projectLabel}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* pt-3 + the editor's own py-1 (4px) = 16px, symmetric with the divider's mt-4 */}
        <div className={cn("mx-auto px-6 pb-6 pt-3", pageWidthClasses.reading)}>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder={t("editors.doc.contentPlaceholder")}
            minHeight="400px"
            borderless
            onInternalLinkClick={handleInternalLinkClick}
          />
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("editors.doc.deleteTitle")}
        description={t("editors.doc.deleteDescription")}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
      <EditorConflictDialog
        open={showConflict && saveStatus === "conflict"}
        onUseExternal={() => { setShowConflict(false); chooseExternal(); }}
        onKeepDesk={() => { setShowConflict(false); keepDesk(); }}
        onCancel={() => { setShowConflict(false); cancelConflict(); }}
      />
    </div>
  );
}
