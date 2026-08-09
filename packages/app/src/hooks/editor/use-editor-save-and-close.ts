/**
 * Hook to handle save-and-close request from the tab bar.
 * Extracted from editor components where this 15-line pattern was duplicated 3 times.
 */
import { useEffect } from "react";
import { useTabStore } from "@/stores";

export function useEditorSaveAndClose(tabId: string, save: () => Promise<boolean>) {
  const pendingSaveAndClose = useTabStore((state) => state.pendingSaveAndClose);
  const clearPendingSaveAndClose = useTabStore((state) => state.clearPendingSaveAndClose);
  const closeTab = useTabStore((state) => state.closeTab);
  const reportFailedSaveAndClose = useTabStore((state) => state.reportFailedSaveAndClose);

  useEffect(() => {
    if (pendingSaveAndClose === tabId) {
      (async () => {
        try {
          const didSave = await save();
          if (didSave) {
            closeTab(tabId);
          } else {
            reportFailedSaveAndClose(tabId);
          }
        } finally {
          clearPendingSaveAndClose();
        }
      })();
    }
  }, [pendingSaveAndClose, tabId, save, clearPendingSaveAndClose, closeTab, reportFailedSaveAndClose]);
}
