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
    void searchIndexController.refresh();
    if (!isTauri()) return;

    return onFileChange((event) => {
      if (event.paths.some((path) => Boolean(getWorkspaceIdFromPath(path)))) {
        void searchIndexController.refresh();
      }
    });
  }, []);

  return { ...state, rebuildIndex: searchIndexController.refresh };
}

export default useSearchIndex;
