import { getDeskService, rebuildIndex, type SearchItem } from "@desk/core";

export type SearchIndexStatus = "idle" | "building" | "ready" | "error";

export interface SearchIndexSnapshot {
  status: SearchIndexStatus;
  revision: number;
  hasUsableIndex: boolean;
}

type Listener = () => void;

export function createSearchIndexController(
  loadItems: () => Promise<SearchItem[]>,
  replaceIndex: (items: SearchItem[]) => void,
) {
  let snapshot: SearchIndexSnapshot = {
    status: "idle",
    revision: 0,
    hasUsableIndex: false,
  };
  let inFlight: Promise<void> | null = null;
  let refreshQueued = false;
  let generation = 0;
  const listeners = new Set<Listener>();

  const publish = (next: SearchIndexSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: () => {
      refreshQueued = true;
      if (inFlight) return inFlight;

      inFlight = (async () => {
        do {
          refreshQueued = false;
          const requestGeneration = generation;
          publish({ ...snapshot, status: "building" });
          try {
            const loadedItems = await loadItems();
            if (requestGeneration !== generation) continue;
            replaceIndex(loadedItems);
            publish({
              status: "ready",
              revision: snapshot.revision + 1,
              hasUsableIndex: true,
            });
          } catch {
            if (requestGeneration === generation) {
              publish({ ...snapshot, status: "error" });
            }
          }
        } while (refreshQueued);
        inFlight = null;
      })();

      return inFlight;
    },
    clear: () => {
      generation += 1;
      refreshQueued = false;
      replaceIndex([]);
      publish({ status: "idle", revision: snapshot.revision + 1, hasUsableIndex: false });
    },
  };
}

export const searchIndexController = createSearchIndexController(
  () => getDeskService().getSearchItems(),
  rebuildIndex,
);
