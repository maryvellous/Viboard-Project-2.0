
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SaveChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  saveLabel?: string;
  dontSaveLabel?: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
  pending?: boolean;
}

/**
 * SaveChangesDialog - Three-button dialog for unsaved changes
 *
 * Standard macOS/Windows pattern:
 * - Save: Save changes and proceed
 * - Don't Save: Discard changes and proceed
 * - Cancel: Abort the operation
 */
export function SaveChangesDialog({
  open,
  onOpenChange,
  title,
  description,
  saveLabel,
  dontSaveLabel,
  onSave,
  onDontSave,
  onCancel,
  pending = false,
}: SaveChangesDialogProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("ui.saveChanges.title");
  const resolvedDescription = description ?? t("ui.saveChanges.description");
  const handleSave = () => {
    onSave();
  };

  const handleDontSave = () => {
    onDontSave();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={pending}>
            {t("common.buttons.cancel")}
          </Button>
          <Button variant="ghost" onClick={handleDontSave} disabled={pending}>
            {dontSaveLabel ?? t("common.buttons.dontSave")}
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {saveLabel ?? t("common.buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
