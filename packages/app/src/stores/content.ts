import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, ContentScope, Asset } from "@desk/core/types";
import { getDeskService, isSameEntity, WORKSPACE_LEVEL_PROJECT_ID } from "@desk/core";
import type { ConvertibleAction, DocLocation } from "@desk/core";
import { invalidateDashboardOverview } from "./dashboard";
import { invalidateProjectInsights } from "./project-insights-invalidation";
import { invalidateEditorDocuments } from "@/lib/query-client";
import { flushEditorSession } from "@/lib/editor-session-controller";
import { useTabStore, type TabItem } from "./tabs";

// Query keys for content (docs, assets, folders)
export const contentKeys = {
  all: ["content"] as const,
  byWorkspace: (workspaceId: string) => [...contentKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, projectId: string, docId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "project", projectId, "detail", docId] as const,
  tree: (scope: ContentScope, workspaceId?: string, projectId?: string) =>
    [...contentKeys.all, "tree", scope, workspaceId || "", projectId || ""] as const,
  // Workspace docs shell (workspace content + project folders)
  shell: (workspaceId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "docs-shell"] as const,
};

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: contentKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return getDeskService().getDocs(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch a single doc
 */
export function useDoc(
  workspaceId: string | null,
  projectId: string | null,
  docId: string | null,
) {
  return useQuery({
    queryKey: contentKeys.detail(workspaceId || "", projectId || "", docId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId || !docId) {
        throw new Error("workspaceId, projectId and docId are required");
      }
      return getDeskService().getDoc(workspaceId, projectId, docId);
    },
    enabled: !!workspaceId && !!projectId && !!docId,
  });
}

/**
 * Hook to create a new doc
 */
export function useCreateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      content?: string;
      templateBody?: string;
      author?: "ai";
    }) => getDeskService().createDoc(data),
    onSuccess: (newDoc) => {
      invalidateDashboardOverview(queryClient);
      invalidateProjectInsights(queryClient, newDoc.workspaceId);
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(newDoc.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useUpdateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      doc,
      updates,
    }: {
      doc: Doc;
      updates: Partial<Pick<Doc, "title" | "content">>;
    }) => getDeskService().updateDoc(doc, updates),
    onSuccess: (updatedDoc) => {
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      if (updatedDoc) {
        invalidateProjectInsights(queryClient, updatedDoc.workspaceId);
        // Directly update doc in all cached list queries (avoids stale file-tree cache race).
        // Query invalidation alone would trigger a refetch that reads from the still-stale
        // file cache, causing the UI to snap back to old values briefly.
        queryClient.setQueriesData<Doc[]>(
          { queryKey: contentKeys.all },
          (old) => {
            if (!Array.isArray(old)) return old;
            return old.map(d => isSameEntity(d, updatedDoc) ? updatedDoc : d);
          }
        );
        // Also update detail query directly
        queryClient.setQueryData(
          contentKeys.detail(updatedDoc.workspaceId, updatedDoc.projectId, updatedDoc.id),
          updatedDoc
        );
      }
    },
  });
}

/**
 * Hook to delete a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doc: Doc) => getDeskService().deleteDoc(doc),
    onSuccess: (success, doc) => {
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      if (success) {
        invalidateProjectInsights(queryClient, doc.workspaceId);
        // Invalidate workspace-scoped queries (prefix-covers project/detail/overview).
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(doc.workspaceId),
        });
        // Also invalidate relevant tree queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", doc.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", doc.workspaceId, doc.projectId),
        });
      }
    },
  });
}

/**
 * Hook to delete an asset (non-markdown file)
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: Asset) => getDeskService().deleteAsset(asset),
    onSuccess: (success, asset) => {
      invalidateDashboardOverview(queryClient);
      if (success) {
        // Invalidate workspace-scoped queries (prefix-covers project/detail/overview).
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(asset.workspaceId),
        });
        // Also invalidate relevant tree queries (assets are in tree)
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", asset.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", asset.workspaceId, asset.projectId),
        });
      }
    },
  });
}

// ============================================================================
// Tree-based hooks for scoped content trees
// ============================================================================

/**
 * Hook to fetch a content tree for a given scope
 */
export function useContentTree(
  scope: ContentScope,
  workspaceId?: string | null,
  projectId?: string | null,
) {
  const enabled =
    scope === "personal" ||
    (scope === "workspace" && !!workspaceId) ||
    (scope === "project" && !!workspaceId && !!projectId);

  return useQuery({
    queryKey: contentKeys.tree(scope, workspaceId || undefined, projectId || undefined),
    queryFn: () =>
      getDeskService().getContentTree(
        scope,
        workspaceId || undefined,
        projectId || undefined,
      ),
    enabled,
  });
}

/**
 * Hook to fetch workspace overview shell (workspace content + project folder stubs).
 * Project content is loaded lazily via useContentTree when folders are expanded.
 */
export function useWorkspaceDocsShell(workspaceId?: string | null) {
  return useQuery({
    queryKey: contentKeys.shell(workspaceId || ""),
    queryFn: () => getDeskService().getWorkspaceDocsShell(workspaceId!),
    enabled: !!workspaceId,
  });
}

/**
 * Hook to create a folder in the content tree
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => getDeskService().createFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to rename a folder in the content tree
 */
export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scope,
      oldPath,
      newName,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      oldPath: string;
      newName: string;
      workspaceId?: string;
      projectId?: string;
    }) => {
      await flushDocumentTabsInFolder(scope, oldPath, workspaceId, projectId);
      return getDeskService().renameFolder(scope, oldPath, newName, workspaceId, projectId);
    },
    onSuccess: (result, variables) => {
      relocateDocumentTabsInFolder(
        variables.scope,
        variables.oldPath,
        result.path,
        variables.workspaceId,
        variables.projectId,
      );
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to delete a folder from the content tree
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => getDeskService().deleteFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to move a folder to a new parent folder
 */
export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scope,
      fromPath,
      toParentPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      fromPath: string;
      toParentPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => {
      await flushDocumentTabsInFolder(scope, fromPath, workspaceId, projectId);
      return getDeskService().moveFolder(scope, fromPath, toParentPath, workspaceId, projectId);
    },
    onSuccess: (moved, variables) => {
      if (moved) {
        const folderName = variables.fromPath.split("/").pop() ?? variables.fromPath;
        const targetPath = variables.toParentPath
          ? `${variables.toParentPath}/${folderName}`
          : folderName;
        relocateDocumentTabsInFolder(
          variables.scope,
          variables.fromPath,
          targetPath,
          variables.workspaceId,
          variables.projectId,
        );
      }
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to move a doc between folders, projects, and workspace scope.
 */
export function useMoveDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      docId,
      workspaceId,
      from,
      to,
    }: {
      docId: string;
      workspaceId: string;
      from: DocLocation;
      to: DocLocation;
    }) => {
      await flushDocumentTab(docId, workspaceId, from);
      return getDeskService().moveDoc(docId, workspaceId, from, to);
    },
    onSuccess: (result, variables) => {
      if (result) {
        const tab = findDocumentTab(variables.docId, variables.workspaceId, variables.from);
        if (tab) {
          useTabStore.getState().relocateEntityTab(tab.id, {
            entityId: result.id,
            projectId: result.projectId,
          });
        }
      }
      invalidateEditorDocuments(queryClient);
      invalidateDashboardOverview(queryClient);
      const { workspaceId, from, to } = variables;
      invalidateProjectInsights(queryClient, workspaceId);
      // Invalidate both source and destination trees.
      for (const loc of [from, to]) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree(loc.scope, workspaceId, loc.projectId),
        });
      }
      queryClient.invalidateQueries({ queryKey: contentKeys.shell(workspaceId) });
    },
  });
}

function editorProjectId(scope: ContentScope, projectId?: string): string | null {
  if (scope === "workspace") return WORKSPACE_LEVEL_PROJECT_ID;
  return projectId ?? null;
}

function documentTabsForLocation(
  workspaceId: string | undefined,
  scope: ContentScope,
  projectId?: string,
): TabItem[] {
  if (!workspaceId) return [];
  const expectedProjectId = editorProjectId(scope, projectId);
  return useTabStore.getState().tabs.filter((tab) =>
    tab.type === "doc"
    && tab.workspaceId === workspaceId
    && (expectedProjectId === null || tab.projectId === expectedProjectId)
  );
}

function findDocumentTab(
  docId: string,
  workspaceId: string,
  location: DocLocation,
): TabItem | undefined {
  return documentTabsForLocation(workspaceId, location.scope, location.projectId)
    .find((tab) => tab.entityId === docId);
}

async function flushDocumentTab(
  docId: string,
  workspaceId: string,
  location: DocLocation,
): Promise<void> {
  const tab = findDocumentTab(docId, workspaceId, location);
  if (tab && !(await flushEditorSession(tab.id))) {
    throw new Error("Resolve the open document's save before moving it");
  }
}

async function flushDocumentTabsInFolder(
  scope: ContentScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string,
): Promise<void> {
  const prefix = `${folderPath}/`;
  const tabs = documentTabsForLocation(workspaceId, scope, projectId)
    .filter((tab) => tab.entityId?.startsWith(prefix));
  const results = await Promise.all(tabs.map((tab) => flushEditorSession(tab.id)));
  if (results.some((saved) => !saved)) {
    throw new Error("Resolve open document saves before moving this folder");
  }
}

function relocateDocumentTabsInFolder(
  scope: ContentScope,
  oldPath: string,
  newPath: string,
  workspaceId?: string,
  projectId?: string,
): void {
  const prefix = `${oldPath}/`;
  const tabs = documentTabsForLocation(workspaceId, scope, projectId)
    .filter((tab) => tab.entityId?.startsWith(prefix));
  for (const tab of tabs) {
    useTabStore.getState().relocateEntityTab(tab.id, {
      entityId: `${newPath}/${tab.entityId!.slice(prefix.length)}`,
    });
  }
}

/**
 * Hook to create a doc in a specific folder
 */
export function useCreateDocInFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      scope: ContentScope;
      title: string;
      content?: string;
      templateBody?: string;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => getDeskService().createDocInFolder(data),
    onSuccess: (_newDoc, variables) => {
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
      // Also invalidate the flat list queries for backward compatibility
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to import files (docs and assets)
 * - Markdown files are imported as editable docs
 * - Other files are copied as assets (binary)
 */
export function useImportFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      scope,
      folderPath,
      workspaceId,
      projectId,
      convertibleAction = "keep",
    }: {
      files: Array<{ name: string; content: string | Uint8Array }>;
      scope: ContentScope;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
      convertibleAction?: ConvertibleAction;
    }) =>
      getDeskService().importFiles(
        files,
        scope,
        folderPath,
        workspaceId,
        projectId,
        convertibleAction,
      ),
    onSuccess: (_result, variables) => {
      invalidateDashboardOverview(queryClient);
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        invalidateProjectInsights(queryClient, variables.workspaceId);
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
      // Also invalidate the flat list queries
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}
