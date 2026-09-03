import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18next from "i18next";
import { getEntityTabId } from "../lib/tab-identity";

import type { IncomingEmail } from "../lib/email/types";

export type TabType = "desk" | "doc" | "task" | "meeting" | "email";

export interface TabItem {
  id: string;
  type: TabType;
  entityId?: string;
  title: string;
  workspaceId?: string;
  projectId?: string;
  isDirty?: boolean;
  isPinned?: boolean;
  // Email-specific: session-only data (not persisted)
  emailData?: IncomingEmail;
}

interface TabState {
  tabs: TabItem[];
  activeTabId: string;
  /** Most recently active tabs, newest first. The active tab itself is excluded. */
  activationHistory: string[];
  /** Tab ID that needs to save before closing */
  pendingSaveAndClose: string | null;
  failedSaveAndClose: string | null;

  // Actions
  openTab: (tab: Omit<TabItem, "id">) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabItem>) => void;
  moveEntityTabToProject: (tabId: string, projectId: string) => void;
  relocateEntityTab: (
    tabId: string,
    location: { entityId?: string; projectId?: string },
  ) => void;
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  closeOtherTabs: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Request save and close for a tab (editor will handle) */
  requestSaveAndClose: (tabId: string) => void;
  /** Clear pending save request (after save completes) */
  clearPendingSaveAndClose: () => void;
  reportFailedSaveAndClose: (tabId: string) => void;
  clearFailedSaveAndClose: () => void;

  // Queries
  getTabByEntityId: (
    type: TabType,
    workspaceId: string,
    projectId: string,
    entityId: string,
  ) => TabItem | undefined;
}

function makeDeskTab(): TabItem {
  return {
    id: "desk",
    type: "desk",
    title: i18next.t("tabs.desk"),
    isPinned: true,
  };
}

function stripSessionOnlyTabData(tab: TabItem): Omit<TabItem, "emailData"> {
  const next = { ...tab };
  delete next.emailData;
  return next;
}

function activateTab(
  state: Pick<TabState, "activeTabId" | "activationHistory">,
  tabId: string,
): Pick<TabState, "activeTabId" | "activationHistory"> {
  if (state.activeTabId === tabId) return state;

  return {
    activeTabId: tabId,
    activationHistory: [
      state.activeTabId,
      ...state.activationHistory.filter(
        (historyId) => historyId !== state.activeTabId && historyId !== tabId,
      ),
    ],
  };
}

function migratePersistedTabs(persistedState: unknown): unknown {
  const state = persistedState as Partial<TabState> | undefined;
  if (!state?.tabs) return persistedState;

  const previousActiveId = state.activeTabId;
  let nextActiveId = "desk";
  const seen = new Set<string>();
  const migratedIds = new Map<string, string>();
  const tabs: TabItem[] = [];

  for (const oldTab of state.tabs) {
    let tab: TabItem | null = null;
    if (oldTab.type === "desk") {
      tab = { ...oldTab, id: "desk" };
    } else if (
      oldTab.type !== "email"
      && oldTab.entityId
      && oldTab.workspaceId
      && oldTab.projectId
    ) {
      tab = {
        ...oldTab,
        id: getEntityTabId(oldTab.type, {
          id: oldTab.entityId,
          workspaceId: oldTab.workspaceId,
          projectId: oldTab.projectId,
        }),
      };
    }

    if (!tab || seen.has(tab.id)) continue;
    seen.add(tab.id);
    migratedIds.set(oldTab.id, tab.id);
    tabs.push(tab);
    if (oldTab.id === previousActiveId) nextActiveId = tab.id;
  }

  if (!seen.has("desk")) tabs.unshift(makeDeskTab());
  const historySeen = new Set<string>();
  const activationHistory = (state.activationHistory ?? [])
    .map((tabId) => migratedIds.get(tabId) ?? tabId)
    .filter((tabId) => {
      if (tabId === nextActiveId || !seen.has(tabId) || historySeen.has(tabId)) return false;
      historySeen.add(tabId);
      return true;
    });
  return { ...state, tabs, activeTabId: nextActiveId, activationHistory };
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [makeDeskTab()],
      activeTabId: "desk",
      activationHistory: [],
      pendingSaveAndClose: null,
      failedSaveAndClose: null,

      openTab: (newTab) => {
        const { tabs } = get();

        // Check if tab for this entity already exists (not for email tabs which are always new)
        if (
          newTab.type !== "desk"
          && newTab.type !== "email"
          && newTab.entityId
          && newTab.workspaceId
          && newTab.projectId
        ) {
          const existing = tabs.find(
            (t) => t.type === newTab.type
              && t.entityId === newTab.entityId
              && t.workspaceId === newTab.workspaceId
              && t.projectId === newTab.projectId
          );
          if (existing) {
            set((state) => activateTab(state, existing.id));
            return;
          }
        }

        // Create new tab
        let id: string;
        if (newTab.type === "desk") {
          id = "desk";
        } else if (newTab.type === "email") {
          // Email tabs use timestamp for unique ID (session only)
          id = `email-${Date.now()}`;
        } else {
          if (!newTab.entityId || !newTab.workspaceId || !newTab.projectId) return;
          id = getEntityTabId(newTab.type, {
            id: newTab.entityId,
            workspaceId: newTab.workspaceId,
            projectId: newTab.projectId,
          });
        }
        const tab: TabItem = { ...newTab, id };

        set((state) => ({
          tabs: [...state.tabs, tab],
          ...activateTab(state, id),
        }));
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId, activationHistory } = get();
        const tab = tabs.find((t) => t.id === tabId);

        // Can't close pinned tabs
        if (!tab || tab.isPinned) return;

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const newTabs = tabs.filter((t) => t.id !== tabId);
        const remainingIds = new Set(newTabs.map((candidate) => candidate.id));
        let newActivationHistory = activationHistory.filter(
          (historyId) => historyId !== tabId && remainingIds.has(historyId),
        );

        // If closing the active tab, return to the most recently active tab.
        // Fall back to the neighboring tab when no usable history exists.
        let newActiveId = activeTabId;
        if (activeTabId === tabId) {
          const previousActiveId = newActivationHistory[0];
          if (previousActiveId) {
            newActiveId = previousActiveId;
          } else if (tabIndex > 0) {
            newActiveId = newTabs[tabIndex - 1].id;
          } else if (newTabs.length > 0) {
            newActiveId = newTabs[0].id;
          }
          newActivationHistory = newActivationHistory.filter(
            (historyId) => historyId !== newActiveId,
          );
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
          activationHistory: newActivationHistory,
        });
      },

      setActiveTab: (tabId) => {
        set((state) => state.tabs.some((tab) => tab.id === tabId)
          ? activateTab(state, tabId)
          : state
        );
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        }));
      },

      moveEntityTabToProject: (tabId, projectId) => {
        get().relocateEntityTab(tabId, { projectId });
      },

      relocateEntityTab: (tabId, location) => {
        const tab = get().tabs.find((candidate) => candidate.id === tabId);
        if (
          !tab
          || tab.type === "desk"
          || tab.type === "email"
          || !tab.entityId
          || !tab.workspaceId
        ) return;

        const entityId = location.entityId ?? tab.entityId;
        const projectId = location.projectId ?? tab.projectId;
        if (!projectId) return;
        const id = getEntityTabId(tab.type, {
          id: entityId,
          workspaceId: tab.workspaceId,
          projectId,
        });
        set((state) => {
          const activeTabId = state.activeTabId === tabId ? id : state.activeTabId;
          const historySeen = new Set<string>();
          const activationHistory = state.activationHistory
            .map((historyId) => historyId === tabId ? id : historyId)
            .filter((historyId) => {
              if (historyId === activeTabId || historySeen.has(historyId)) return false;
              historySeen.add(historyId);
              return true;
            });
          return {
            tabs: state.tabs.map((candidate) =>
              candidate.id === tabId
                ? { ...candidate, id, entityId, projectId }
                : candidate
            ),
            activeTabId,
            activationHistory,
          };
        });
      },

      setTabDirty: (tabId, isDirty) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty } : t
          ),
        }));
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          const tabs = state.tabs.filter((tab) => tab.id === tabId || tab.isPinned);
          const remainingIds = new Set(tabs.map((tab) => tab.id));
          const activation = activateTab(state, tabId);
          return {
            tabs,
            activeTabId: activation.activeTabId,
            activationHistory: activation.activationHistory.filter(
              (historyId) => historyId !== tabId && remainingIds.has(historyId),
            ),
          };
        });
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          // Don't allow moving pinned tabs or moving before pinned tabs
          const pinnedCount = newTabs.filter((t) => t.isPinned).length;
          if (fromIndex < pinnedCount || toIndex < pinnedCount) return state;

          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { tabs: newTabs };
        });
      },

      getTabByEntityId: (type, workspaceId, projectId, entityId) => {
        return get().tabs.find(
          (t) => t.type === type
            && t.entityId === entityId
            && t.workspaceId === workspaceId
            && t.projectId === projectId,
        );
      },

      requestSaveAndClose: (tabId) => {
        set({ pendingSaveAndClose: tabId });
      },

      clearPendingSaveAndClose: () => {
        set({ pendingSaveAndClose: null });
      },
      reportFailedSaveAndClose: (tabId) => {
        set({ failedSaveAndClose: tabId });
      },
      clearFailedSaveAndClose: () => {
        set({ failedSaveAndClose: null });
      },
    }),
    {
      name: "desk-tabs",
      version: 3,
      migrate: migratePersistedTabs,
      partialize: (state) => {
        // Filter out session-only email tabs and strip emailData.
        const tabs = state.tabs
          .filter((t) => t.type !== "email")
          .map(stripSessionOnlyTabData);
        const persistedIds = new Set(tabs.map((tab) => tab.id));
        const activeTabId = state.activeTabId === "desk" || !state.activeTabId.startsWith("email-")
          ? state.activeTabId
          : "desk";
        return {
          tabs,
          activeTabId,
          activationHistory: state.activationHistory.filter(
            (tabId) => tabId !== activeTabId && persistedIds.has(tabId),
          ),
        };
      },
    }
  )
);

// Helper hook for opening entity tabs
export function useOpenTab() {
  const openTab = useTabStore((state) => state.openTab);

  return {
    openDoc: (doc: { id: string; title: string; workspaceId: string; projectId: string }) => {
      openTab({
        type: "doc",
        entityId: doc.id,
        title: doc.title,
        workspaceId: doc.workspaceId,
        projectId: doc.projectId,
      });
    },
    openTask: (task: { id: string; title: string; workspaceId: string; projectId: string }) => {
      openTab({
        type: "task",
        entityId: task.id,
        title: task.title,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
      });
    },
    openMeeting: (meeting: { id: string; title: string; workspaceId: string; projectId: string }) => {
      openTab({
        type: "meeting",
        entityId: meeting.id,
        title: meeting.title,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
      });
    },
    openDesk: () => {
      useTabStore.getState().setActiveTab("desk");
    },
    openEmail: (email: IncomingEmail) => {
      openTab({
        type: "email",
        title: email.subject || i18next.t("tabs.emailDefault"),
        emailData: email,
      });
    },
  };
}
