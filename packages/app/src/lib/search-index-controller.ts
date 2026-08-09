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
      if (inFlight) return inFlight;

      publish({ ...snapshot, status: "building" });
      inFlight = (async () => {
        try {
          replaceIndex(await loadItems());
          publish({
            status: "ready",
            revision: snapshot.revision + 1,
            hasUsableIndex: true,
          });
        } catch {
          publish({ ...snapshot, status: "error" });
        } finally {
          inFlight = null;
        }
      })();

      return inFlight;
    },
  };
}

export const searchIndexController = createSearchIndexController(
  () => getDeskService().getSearchItems(),
  rebuildIndex,
);
