import "@/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { queryClient } from "@/lib/query-client";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@/stores/preferences";
import {
  expandHostFsScope,
  initializeHostDeskDirectory,
} from "@/lib/host-files";
import { isLocalDisk } from "@/lib/connection";
import { useQueryInvalidator } from "@/hooks/use-query-invalidator";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useWindowClose } from "@/hooks/use-window-close";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { useSuppressContextMenu } from "@/hooks/use-suppress-context-menu";
import { SaveChangesDialog } from "@/components/ui/save-changes-dialog";
import { Button } from "@/components/ui/button";
import { EmailDropOverlay } from "@/components/email/email-drop-overlay";
import { toast } from "sonner";
import { AppBootScreen } from "./boot-screen";
import { applyThemePreference } from "@/lib/theme";
import {
  flushAllEditorSessions,
  hasEditorRecoveryFailure,
  discardAllEditorSessions,
} from "@/lib/editor-session-controller";

interface ProvidersProps {
  children: React.ReactNode;
}

// Blocking error screen shown when startup initialization fails. Rendering the
// app anyway would only produce a confusing, broken state (no data folder).
function StartupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/30 bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {t("errors.startup.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("errors.startup.description")}
        </p>
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-left text-xs text-muted-foreground">
          {message}
        </pre>
        <p className="text-sm text-muted-foreground">
          {t("errors.startup.hint")}
        </p>
        <Button onClick={onRetry}>{t("common.buttons.retry")}</Button>
      </div>
    </div>
  );
}

// Initialize Tauri file system on startup
function TauriInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const runInit = useCallback(async () => {
    setInitError(null);
    setInitialized(false);
    // Local-disk setup (Tauri FS scope + creating ~/DeskMD) only applies when the domain
    // runs on THIS machine. In native-remote mode `isTauri()` is still true but storage is
    // the GuardStorageProvider, so initDeskDirectory() would throw — the data folder lives
    // on the server. Gate on isLocalDisk(), never bare isTauri() (the rule in CLAUDE.md).
    if (isLocalDisk()) {
      try {
        await expandHostFsScope();
        await initializeHostDeskDirectory();
      } catch (error) {
        console.error("[Desk] Failed to initialize:", error);
        setInitError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    void runInit();
  }, [runInit]);

  if (initError) {
    return <StartupError message={initError} onRetry={() => void runInit()} />;
  }

  if (!initialized) {
    return <AppBootScreen />;
  }

  return <>{children}</>;
}

// Initialize query invalidator for live updates
function QueryInvalidatorProvider({ children }: { children: React.ReactNode }) {
  useQueryInvalidator();
  return <>{children}</>;
}

// Initialize search index
function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  useSearchIndex();
  return <>{children}</>;
}

// Check for updates on launch and show toast if available
function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { status, updateInfo, downloadAndInstall, dismiss } = useUpdateChecker();
  const dismissedUpdateVersion = usePreferencesStore((s) => s.dismissedUpdateVersion);

  useEffect(() => {
    if (
      status === "available" &&
      updateInfo &&
      updateInfo.version !== dismissedUpdateVersion
    ) {
      toast(t("updates.available", { version: updateInfo.version }), {
        description: t("updates.description"),
        action: {
          label: t("updates.updateAndRestart"),
          onClick: () => downloadAndInstall(),
        },
        cancel: {
          label: t("updates.skip"),
          onClick: () => dismiss(),
        },
        duration: 15000,
      });
    }
  }, [status, updateInfo, downloadAndInstall, dismiss, dismissedUpdateVersion, t]);

  return <>{children}</>;
}

// Handle window close with unsaved changes check
function WindowCloseProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    dirtyTabs: string[];
    discardFailed?: boolean;
    discarding?: boolean;
  }>({ open: false, dirtyTabs: [] });

  const handleCloseRequested = useCallback((dirtyTabs: string[]) => {
    setDialogState({ open: true, dirtyTabs });
  }, []);

  const { confirmClose, cancelClose } = useWindowClose(handleCloseRequested);

  const handleSave = useCallback(() => {
    setDialogState({ open: false, dirtyTabs: [] });
    void flushAllEditorSessions().then((saved) => {
      if (saved) void confirmClose();
      else cancelClose();
    });
  }, [cancelClose, confirmClose]);

  const handleDontSave = useCallback(() => {
    if (dialogState.discarding) return;
    setDialogState((current) => ({
      ...current,
      discardFailed: false,
      discarding: true,
    }));
    void discardAllEditorSessions().then((discarded) => {
      if (!discarded) {
        toast.error(t("editors.shared.discardFailed"));
        setDialogState((current) => ({
          ...current,
          discardFailed: true,
          discarding: false,
        }));
        return;
      }
      setDialogState({ open: false, dirtyTabs: [] });
      void confirmClose();
    });
  }, [confirmClose, dialogState.discarding, t]);

  const handleCancel = useCallback(() => {
    setDialogState({ open: false, dirtyTabs: [] });
    cancelClose();
  }, [cancelClose]);

  const tabCount = dialogState.dirtyTabs.length;
  const tabNames = dialogState.dirtyTabs.slice(0, 3).join(", ");
  const moreCount = tabCount > 3 ? t("unsavedChanges.more", { count: tabCount - 3 }) : "";

  return (
    <>
      {children}
      <SaveChangesDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) {
            if (dialogState.discarding) return;
            setDialogState({ open: false, dirtyTabs: [] });
            cancelClose();
          }
        }}
        title={t("unsavedChanges.title")}
        description={dialogState.discardFailed
          ? t("editors.shared.discardFailed")
          : t("unsavedChanges.description", { tabs: tabNames, more: moreCount })}
        dontSaveLabel={dialogState.discardFailed
          ? t("editors.shared.retryDiscard")
          : undefined}
        onSave={handleSave}
        onDontSave={handleDontSave}
        onCancel={handleCancel}
        pending={dialogState.discarding}
      />
    </>
  );
}

// Suppress the native WebView context menu outside text-editing surfaces
function ContextMenuSuppressionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useSuppressContextMenu();
  return <>{children}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((state) => state.theme);

  useEffect(() => {
    return applyThemePreference(theme);
  }, [theme]);

  return <>{children}</>;
}

function EditorFlushProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const flush = () => void flushAllEditorSessions();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasEditorRecoveryFailure()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("blur", flush);
    window.addEventListener("online", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("online", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TauriInitializer>
        <UpdateProvider>
          <QueryInvalidatorProvider>
            <SearchIndexProvider>
              <WindowCloseProvider>
                <EditorFlushProvider>
                  <ThemeProvider>
                    <ContextMenuSuppressionProvider>
                      {children}
                      <EmailDropOverlay />
                    </ContextMenuSuppressionProvider>
                  </ThemeProvider>
                </EditorFlushProvider>
              </WindowCloseProvider>
            </SearchIndexProvider>
          </QueryInvalidatorProvider>
        </UpdateProvider>
      </TauriInitializer>
    </QueryClientProvider>
  );
}
