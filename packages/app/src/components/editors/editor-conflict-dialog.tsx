import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface EditorConflictDialogProps {
  open: boolean;
  onUseExternal: () => void;
  onKeepDesk: () => void;
  onCancel: () => void;
}

export function EditorConflictDialog({
  open,
  onUseExternal,
  onKeepDesk,
  onCancel,
}: EditorConflictDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("editors.shared.conflict.title")}</DialogTitle>
          <DialogDescription>
            {t("editors.shared.conflict.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel}>{t("common.buttons.cancel")}</Button>
          <Button variant="ghost" onClick={onUseExternal}>{t("editors.shared.conflict.useExternal")}</Button>
          <Button onClick={onKeepDesk}>{t("editors.shared.conflict.keepDesk")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
