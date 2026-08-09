import { lazy, Suspense, useState } from "react";
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
import { isTauri } from "@desk/core";
import { getDeskService } from "@desk/core";
import { expandHostFsScope } from "@/lib/host-files";
import { isRemoteMode } from "@/lib/connection";
import { prepareEditorContextTransition } from "@/lib/editor-session-controller";

// Hosted mode only: the account/sign-out section (and better-auth) is lazy-loaded
// behind the build flag, so the desktop bundle never includes it.
const HostedAccountSection = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./hosted-account-section"))
  : null;

// Native hosted mode: the local/remote backend toggle. Bundled in every non-hosted
// build (constant `!VITE_DESK_HOSTED`, so the lean web build tree-shakes it out) and
// shown only inside a Tauri webview (isTauri(), checked at render).
const ConnectionSection = !import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./connection-section"))
  : null;

export function DataTab() {
  const { t } = useTranslation();
  const { dataPath, setDataPath, setSetupCompleted, reset: resetBoot } = useBootStore();
  // The local data folder is meaningless when connected to a remote server. Non-reactive
  // is fine: switching connection always reloads the app, so this component remounts.
  const remote = isRemoteMode();
  const { reset: resetPreferences } = usePreferencesStore();
  const { setCurrentWorkspaceId, reset: resetNavigation } = useNavigationStore();

  const queryClient = useQueryClient();

  // State for data path change dialog
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
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", systemDark);
    toast.success(t("toasts.settings.settingsReset"));
    window.location.reload();
  };

  const handleCheckDataPath = () => {
    if (!pendingPath.trim()) return;
    setPathDialogOpen(true);
  };

  const handleConfirmPathChange = async () => {
    const previousPath = dataPath;
    setIsCheckingPath(true);
    try {
      if (!(await prepareEditorContextTransition())) {
        toast.error(t("editors.shared.contextTransitionBlocked"));
        return;
      }
      if (isTauri()) {
        await expandHostFsScope(pendingPath);
      }
      setDataPath(pendingPath);
      const existingWorkspaces = isTauri()
        ? await getDeskService().getWorkspaces()
        : [];
      if (existingWorkspaces.length > 0) {
        setCurrentWorkspaceId(existingWorkspaces[0].id);
      } else {
        setSetupCompleted(false);
      }
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch DeskMD data folder:", error);
      setDataPath(previousPath);
      if (isTauri()) {
        try {
          await expandHostFsScope(previousPath);
        } catch (rollbackError) {
          console.error("Failed to restore previous DeskMD data folder:", rollbackError);
        }
      }
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCheckingPath(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Connection — local/remote backend toggle (native, non-hosted builds, Tauri only). */}
      {ConnectionSection && isTauri() && (
        <Suspense fallback={null}>
          <ConnectionSection />
        </Suspense>
      )}

      {/* Account — sign-out (hosted web build only). */}
      {HostedAccountSection && (
        <Suspense fallback={null}>
          <HostedAccountSection />
        </Suspense>
      )}

      {/* Data Storage — local mode only (a remote backend owns the data root). */}
      {!remote && (
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
                onClick={handleCheckDataPath}
                disabled={isCheckingPath || !pendingPath.trim() || pendingPath === dataPath}
              >
                {isCheckingPath && <InlineProgress />}
                {t("settings.data.storage.change")}
              </Button>
            </div>
            </SettingsField>
          </SettingsGroup>
        </SettingsSection>
      )}

      {/* Reset Settings */}
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

      {/* Reset Settings Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title={t("settings.data.resetDialog.title")}
        description={t("settings.data.resetDialog.description")}
        confirmLabel={t("settings.data.resetDialog.confirmLabel")}
        variant="destructive"
        onConfirm={handleResetConfirm}
      />

      {/* Data Path Change Dialog */}
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
