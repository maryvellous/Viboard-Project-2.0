import { useEffect, useSyncExternalStore } from "react";
import { getWorkspaceIdFromPath, isTauri } from "@desk/core";
import { onFileChange } from "@/lib/desk-watcher";
import { searchIndexController } from "@/lib/search-index-controller";

export function useSearchIndexState() {
  return useSyncExternalStore(
    searchIndexController.subscribe,
    searchIndexController.getSnapshot,
    searchIndexController.getSnapshot,
  );
}

/** Build the shared index at startup and refresh it after local file changes. */
export function useSearchIndex() {
  const state = useSearchIndexState();

  useEffect(() => {
    // Let the first interactive frame land before scanning workspace content.
    const startupTimer = window.setTimeout(() => {
      void searchIndexController.refresh();
    }, 200);

    const stopWatchingChanges = isTauri()
      ? onFileChange((event) => {
          if (event.paths.some((path) => Boolean(getWorkspaceIdFromPath(path)))) {
            void searchIndexController.refresh();
          }
        })
      : undefined;

    return () => {
      window.clearTimeout(startupTimer);
      stopWatchingChanges?.();
    };
  }, []);

  return { ...state, rebuildIndex: searchIndexController.refresh };
}

export default useSearchIndex;
