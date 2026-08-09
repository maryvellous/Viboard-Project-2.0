/**
 * Shared render states for all editor components.
 * Handles: file deleted, file moved, loading, and not-found states.
 * Returns null if none apply (editor should render normally).
 */
import { useTranslation } from "react-i18next";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { FileMovedBanner, FileDeletedBanner } from "@/components/ui/editor-banners";
import { toast } from "sonner";

interface EditorRenderStatesProps {
  fileDeleted: boolean;
  pathChanged: boolean;
  newPath: string | null;
  isLoading: boolean;
  entity: unknown | null | undefined;
  entityLabel: string;
  loadError?: unknown;
  serverVersionMismatch?: boolean;
  onRetryLoad?: () => void;
  onClose: () => void;
  acknowledgePathChange: () => void;
  acknowledgeDeleted: () => void;
  /** True if the editor has unsaved edits that can be restored */
  isDirty?: boolean;
  /** Re-create the file from in-memory edits */
  onRecover?: () => Promise<boolean>;
  recoveryBlocked?: "parent-missing" | null;
  recovering?: boolean;
  /** Explicitly discard a protected draft before closing a missing file. */
  onDiscard?: () => Promise<boolean>;
}

export function EditorRenderStates({
  fileDeleted,
  pathChanged,
  newPath,
  isLoading,
  entity,
  entityLabel,
  loadError,
  serverVersionMismatch,
  onRetryLoad,
  onClose,
  acknowledgePathChange,
  acknowledgeDeleted,
  isDirty,
  onRecover,
  recoveryBlocked,
  recovering,
  onDiscard,
}: EditorRenderStatesProps) {
  const { t } = useTranslation();

  // Translated, capitalized entity name used in "<Entity> not found".
  const entityKeyMap: Record<string, string> = {
    doc: "editors.shared.entityName.doc",
    task: "editors.shared.entityName.task",
    meeting: "editors.shared.entityName.meeting",
  };
  const entityName =
    entityKeyMap[entityLabel] !== undefined
      ? t(entityKeyMap[entityLabel])
      : entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

  if (fileDeleted) {
    return (
      <FileDeletedBanner
        hasUnsavedEdits={isDirty}
        onRecover={onRecover}
        recoveryBlocked={recoveryBlocked}
        recovering={recovering}
        onClose={() => {
          void (onDiscard?.() ?? Promise.resolve(true)).then((discarded) => {
            if (!discarded) {
              toast.error(t("editors.shared.discardFailed"));
              return;
            }
            acknowledgeDeleted();
            onClose();
          });
        }}
      />
    );
  }

  if (pathChanged && newPath) {
    return (
      <FileMovedBanner
        newPath={newPath}
        onAcknowledge={acknowledgePathChange}
      />
    );
  }

  // A canonical read error must block the editor. Rendering the controlled
  // editor with its default empty value would look exactly like data loss and
  // could invite the user to type into a document that was never loaded.
  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="font-medium text-foreground">
            {serverVersionMismatch
              ? t("editors.shared.versionMismatch.title")
              : t("editors.shared.loadFailed.title", { entity: entityName })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {serverVersionMismatch
              ? t("editors.shared.versionMismatch.description")
              : t("editors.shared.loadFailed.description")}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={onRetryLoad}>{t("common.buttons.retry")}</Button>
            <Button variant="ghost" onClick={onClose}>
              {t("editors.shared.closeTab")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton variant="editor" />;
  }

  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>{t("editors.shared.entityNotFound", { entity: entityName })}</p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            {t("editors.shared.closeTab")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
