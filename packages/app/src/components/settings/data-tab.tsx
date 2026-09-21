import { useState } from "react";
import { SettingsField, SettingsGroup, SettingsSection } from "@/components/ui/settings-section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineProgress } from "@/components/ui/inline-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useBootStore } from "@/stores/boot";
import { usePreferencesStore } from "@/stores/preferences";
import { useNavigationStore } from "@/stores/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri, getDeskService } from "@desk/core";
import { expandHostFsScope } from "@/lib/host-files";
import { prepareEditorContextTransition } from "@/lib/editor-session-controller";

export function DataTab() {
  const { t } = useTranslation();
  const { dataPath, setDataPath, setSetupCompleted, reset: resetBoot } = useBootStore();
  const { reset: resetPreferences } = usePreferencesStore();
  const { setCurrentWorkspaceId, reset: resetNavigation } = useNavigationStore();
  const queryClient = useQueryClient();

  const [pendingPath, setPendingPath] = useState("");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetConfirm = async () => {
    if (!(await prepareEditorContextTransition())) {
      toast.error(t("editors.shared.contextTransitionBlocked"));
      return;
    }
    resetBoot();
    resetPreferences();
    resetNavigation();
    queryClient.invalidateQueries();
    document.documentElement.classList.add("dark");
    toast.success(t("toasts.settings.settingsReset"));
    window.location.reload();
  };

  const handleConfirmPathChange = async () => {
    const previousPath = dataPath;
    setIsCheckingPath(true);
    try {
      if (!(await prepareEditorContextTransition())) {
        toast.error(t("editors.shared.contextTransitionBlocked"));
        return;
      }
      if (isTauri()) await expandHostFsScope(pendingPath);
      setDataPath(pendingPath);
      const existingWorkspaces = isTauri() ? await getDeskService().getWorkspaces() : [];
      if (existingWorkspaces.length > 0) {
        setCurrentWorkspaceId(existingWorkspaces[0].id);
      } else {
        setSetupCompleted(false);
      }
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch Viboard data folder:", error);
      setDataPath(previousPath);
      if (isTauri()) {
        try {
          await expandHostFsScope(previousPath);
        } catch (rollbackError) {
          console.error("Failed to restore previous Viboard data folder:", rollbackError);
        }
      }
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCheckingPath(false);
    }
  };

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t("settings.data.storage.title")}
        description={t("settings.data.storage.description")}
      >
        <SettingsGroup>
          <SettingsField
            label={t("settings.data.storage.pathLabel")}
            htmlFor="data-path"
            footer={t("settings.data.storage.helperText")}
          >
            <div className="flex gap-2">
              <Input
                id="data-path"
                value={pendingPath || dataPath}
                onChange={(e) => setPendingPath(e.target.value)}
                placeholder={t("settings.data.storage.pathPlaceholder")}
                className="bg-background/80 font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => pendingPath.trim() && setPathDialogOpen(true)}
                disabled={isCheckingPath || !pendingPath.trim() || pendingPath === dataPath}
              >
                {isCheckingPath && <InlineProgress />}
                {t("settings.data.storage.change")}
              </Button>
            </div>
          </SettingsField>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title={t("settings.data.reset.title")}
        description={t("settings.data.reset.description")}
      >
        <SettingsGroup tone="danger">
          <SettingsField footer={t("settings.data.reset.helperText")}>
            <Button variant="destructive" onClick={() => setShowResetConfirm(true)}>
              {t("settings.data.reset.button")}
            </Button>
          </SettingsField>
        </SettingsGroup>
      </SettingsSection>

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title={t("settings.data.resetDialog.title")}
        description={t("settings.data.resetDialog.description")}
        confirmLabel={t("settings.data.resetDialog.confirmLabel")}
        variant="destructive"
        onConfirm={handleResetConfirm}
      />

      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderPlus className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>{t("settings.data.pathDialog.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.data.pathDialog.confirmDescription", { path: pendingPath })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => void handleConfirmPathChange()} disabled={isCheckingPath}>
              {isCheckingPath && <InlineProgress />}
              {t("settings.data.pathDialog.confirmSwitch")}
            </Button>
            <Button variant="outline" onClick={() => setPathDialogOpen(false)} disabled={isCheckingPath}>
              {t("common.buttons.cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
