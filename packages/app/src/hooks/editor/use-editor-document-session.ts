import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDeskService,
  generatePreview,
  subscribeToEditorEvents,
  type EditorDocumentRef,
  type EditorDocumentSnapshot,
} from "@desk/core";
import type { Doc, Meeting, Project, Task, Workspace } from "@desk/core/types";
import { toast } from "sonner";
import { editorDocumentRootKey, mapQueryArray, queryClient } from "@/lib/query-client";
import {
  EditorSessionController,
  registerEditorSession,
  type EditorSessionState,
} from "@/lib/editor-session-controller";
import {
  IndexedDbEditorRecovery,
  editorRecoveryNamespace,
} from "@/lib/editor-recovery";
import { useOpenEditorRegistry, type EditorType } from "@/stores/open-editor-registry";
import {
  contentKeys,
  meetingKeys,
  projectKeys,
  taskKeys,
  workspaceKeys,
} from "@/stores";
import { plannerKeys } from "@/stores/planner";
import { invalidateDashboardOverview } from "@/stores/dashboard";
import { invalidateProjectInsights } from "@/stores/project-insights-invalidation";
import { isUnsupportedDeskOperation } from "@/lib/project-service-compat";

export const editorDocumentKeys = {
  all: editorDocumentRootKey,
  detail: (ref: EditorDocumentRef) => [...editorDocumentKeys.all, ref] as const,
};

interface UseEditorDocumentSessionOptions {
  ref: EditorDocumentRef;
  enabled?: boolean;
  editorType?: EditorType;
  entityId?: string;
  sessionKey?: string;
}

export function useEditorDocumentSession({
  ref,
  enabled = true,
  editorType,
  entityId,
  sessionKey,
}: UseEditorDocumentSessionOptions) {
  const refKey = useMemo(() => JSON.stringify(ref), [ref]);
  const stableRef = useMemo(() => ref, [refKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const recoveryNamespace = editorRecoveryNamespace();
  const recovery = useMemo(
    () => new IndexedDbEditorRecovery(recoveryNamespace),
    [recoveryNamespace],
  );
  const query = useQuery({
    queryKey: editorDocumentKeys.detail(stableRef),
    queryFn: () => getDeskService().getEditorDocument(stableRef),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [controller, setController] = useState<EditorSessionController | null>(null);
  const controllerRef = useRef<EditorSessionController | null>(null);
  const recoveryLoadRef = useRef<symbol | null>(null);
  const [state, setState] = useState<EditorSessionState | null>(null);
  const [pathChanged, setPathChanged] = useState(false);
  const [newPath, setNewPath] = useState<string | null>(null);

  useEffect(() => {
    controllerRef.current?.dispose();
    controllerRef.current = null;
    recoveryLoadRef.current = null;
    setController(null);
    setState(null);
    setPathChanged(false);
    setNewPath(null);
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      recoveryLoadRef.current = null;
    };
  }, [enabled, refKey, recoveryNamespace]);

  useEffect(() => {
    if (!enabled || !query.isFetched || controllerRef.current || recoveryLoadRef.current) return;
    const canonicalSnapshot = query.data ?? null;
    const loadToken = Symbol(refKey);
    recoveryLoadRef.current = loadToken;
    const createController = (savedRecovery: Awaited<ReturnType<typeof recovery.load>>) => {
      if (recoveryLoadRef.current !== loadToken || controllerRef.current) return;
      const initialSnapshot = canonicalSnapshot ?? savedRecovery?.baseSnapshot;
      if (!initialSnapshot) {
        recoveryLoadRef.current = null;
        return;
      }
      const created = new EditorSessionController({
        snapshot: initialSnapshot,
        recovery: savedRecovery,
        save: (expectedRevision, patch) => getDeskService().saveEditorDocument({
          ref: stableRef,
          expectedRevision,
          patch,
        }),
        recreate: (baseSnapshot, patch) => getDeskService().saveEditorDocument({
          ref: stableRef,
          expectedRevision: null,
          patch,
          baseSnapshot,
        }),
        persistRecovery: (baseSnapshot, draft, editVersion) =>
          recovery.save(stableRef, baseSnapshot, draft, editVersion),
        clearRecovery: () => recovery.clear(stableRef),
        onSaved: (snapshot) => patchEditorCaches(snapshot),
      });
      if (query.data === null) created.markMissing();
      controllerRef.current = created;
      setController(created);
      setState(created.getSnapshot());
      if (savedRecovery && created.getSnapshot().restoredRecovery) {
        toast.info(
          !canonicalSnapshot || savedRecovery.baseRevision === canonicalSnapshot.revision
            ? "Recovered unsaved edits"
            : "Recovered edits need review",
        );
      }
    };
    void recovery.load(stableRef).then(createController).catch((error) => {
      console.error("[editor-session] Could not load recovery draft:", error);
      // Recovery storage must never prevent access to a healthy canonical file.
      // A later edit retries IndexedDB through the normal persistence path.
      if (canonicalSnapshot) createController(null);
      else if (recoveryLoadRef.current === loadToken) recoveryLoadRef.current = null;
    });
  }, [enabled, refKey, query.data, query.isFetched, recovery, stableRef]);

  useEffect(() => {
    if (!controller) return;
    setState(controller.getSnapshot());
    return controller.subscribe(() => setState(controller.getSnapshot()));
  }, [controller]);

  useEffect(() => {
    if (!controller) return;
    if (query.data) controller.adoptCanonical(query.data);
    else if (query.data === null) controller.markMissing();
  }, [controller, query.data?.revision, query.data, query.isFetched]);

  useEffect(() => {
    if (!controller) return;
    return registerEditorSession(sessionKey ?? refKey, controller);
  }, [controller, refKey, sessionKey]);

  useEffect(() => {
    const filePath = state?.confirmed.filePath;
    if (!controller || !filePath || !editorType || !entityId) return;
    const registry = useOpenEditorRegistry.getState();
    registry.register(filePath, { type: editorType, entityId });
    const unsubscribe = subscribeToEditorEvents(filePath, {
      onContentUpdate: () => {
        void queryClient.invalidateQueries({ queryKey: editorDocumentKeys.detail(stableRef) });
      },
      onDeleted: () => controller.markMissing(),
      onPathChange: (path) => {
        setPathChanged(true);
        setNewPath(path);
      },
    });
    return () => {
      unsubscribe();
      registry.unregister(filePath);
    };
  }, [controller, state?.confirmed.filePath, editorType, entityId, stableRef]);

  const acceptPathChange = useCallback((path: string) => {
    const oldPath = state?.confirmed.filePath;
    if (oldPath) useOpenEditorRegistry.getState().acknowledgePathChange(oldPath);
    setPathChanged(false);
    setNewPath(null);
    void queryClient.invalidateQueries({ queryKey: editorDocumentKeys.all });
    void path;
  }, [state?.confirmed.filePath]);

  const acknowledgePathChange = useCallback(() => {
    if (state?.confirmed.filePath) {
      useOpenEditorRegistry.getState().acknowledgePathChange(state.confirmed.filePath);
    }
    setPathChanged(false);
    setNewPath(null);
  }, [state?.confirmed.filePath]);

  const acknowledgeDeleted = useCallback(() => {
    if (state?.confirmed.filePath) {
      useOpenEditorRegistry.getState().acknowledgeDeleted(state.confirmed.filePath);
    }
  }, [state?.confirmed.filePath]);

  // Never let a failed canonical read fall through to an editable empty string.
  // This is particularly important during a rolling client/server upgrade: an
  // older server does not know the versioned editor RPC yet, but list/detail
  // queries can still succeed and make the rest of the editor look ready.
  const loadError = !state && query.isError ? query.error : null;

  return {
    snapshot: query.data,
    state,
    content: state?.draft.body ?? "",
    metadata: state?.draft.metadata ?? {},
    setContent: (body: string) => controller?.editBody(body),
    setMetadata: (field: string, value: unknown, immediate = false) =>
      controller?.editMetadata(field, value, immediate),
    restoreEmptyTitle: () => controller?.restoreEmptyTitle(),
    isLoading: query.isLoading || (Boolean(query.data) && !state),
    isDirty: Boolean(state?.dirtyFields.size),
    saveStatus: state?.status ?? "idle",
    error: state?.error ?? null,
    conflict: state?.conflict ?? null,
    recoveryFailed: state?.recoveryFailed ?? false,
    recoveryBlocked: state?.recoveryBlocked ?? null,
    loadError,
    serverVersionMismatch: Boolean(
      loadError && isUnsupportedDeskOperation(loadError, "getEditorDocument"),
    ),
    fileDeleted: state?.status === "missing" || (query.isFetched && query.data === null),
    pathChanged,
    newPath,
    save: () => controller?.flush() ?? Promise.resolve(false),
    retryLoad: () => query.refetch().then(() => undefined),
    retry: () => controller?.retry(),
    useExternal: () => controller?.useExternal(),
    keepDesk: () => controller?.keepDesk(),
    cancelConflict: () => controller?.cancelConflict(),
    discard: () => controller?.discard() ?? Promise.resolve(true),
    acknowledgePathChange,
    acceptPathChange,
    acknowledgeDeleted,
    recover: () => controller?.recreate() ?? Promise.resolve(false),
  };
}

function patchEditorCaches(snapshot: EditorDocumentSnapshot): void {
  queryClient.setQueryData(editorDocumentKeys.detail(snapshot.ref), snapshot);
  invalidateDashboardOverview(queryClient);
  invalidateProjectInsights(queryClient, snapshot.ref.workspaceId);
  switch (snapshot.kind) {
    case "task": {
      const ref = snapshot.ref;
      const patch = (task: Task): Task => ({
        ...task,
        ...snapshot.metadata,
        content: snapshot.body,
        filePath: snapshot.filePath,
      });
      queryClient.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (old) =>
        mapQueryArray(old, (task) =>
          task.id === ref.id && task.workspaceId === ref.workspaceId && task.projectId === ref.projectId ? patch(task) : task
        ),
      );
      queryClient.setQueriesData<Task[]>({ queryKey: plannerKeys.all }, (old) =>
        mapQueryArray(old, (task) =>
          task.id === ref.id && task.workspaceId === ref.workspaceId && task.projectId === ref.projectId ? patch(task) : task
        ),
      );
      queryClient.setQueryData<Task | null>(taskKeys.detail(ref.workspaceId, ref.projectId, ref.id), (old) => old ? patch(old) : old);
      break;
    }
    case "document": {
      const ref = snapshot.ref;
      const patch = (doc: Doc): Doc => ({
        ...doc,
        ...snapshot.metadata,
        content: snapshot.body,
        preview: generatePreview(snapshot.body),
        filePath: snapshot.filePath,
      });
      queryClient.setQueriesData<Doc[]>({ queryKey: contentKeys.all }, (old) =>
        mapQueryArray(old, (doc) =>
          doc.id === ref.id && doc.workspaceId === ref.workspaceId && doc.projectId === ref.projectId ? patch(doc) : doc
        ),
      );
      queryClient.setQueryData<Doc | null>(contentKeys.detail(ref.workspaceId, ref.projectId, ref.id), (old) => old ? patch(old) : old);
      break;
    }
    case "meeting": {
      const ref = snapshot.ref;
      const patch = (meeting: Meeting): Meeting => ({
        ...meeting,
        ...snapshot.metadata,
        content: snapshot.body,
        preview: generatePreview(snapshot.body),
        filePath: snapshot.filePath,
      });
      queryClient.setQueriesData<Meeting[]>({ queryKey: meetingKeys.all }, (old) =>
        mapQueryArray(old, (meeting) =>
          meeting.id === ref.id && meeting.workspaceId === ref.workspaceId && meeting.projectId === ref.projectId ? patch(meeting) : meeting
        ),
      );
      queryClient.setQueryData<Meeting | null>(meetingKeys.detail(ref.workspaceId, ref.projectId, ref.id), (old) => old ? patch(old) : old);
      break;
    }
    case "workspace-overview": {
      const ref = snapshot.ref;
      queryClient.setQueriesData<Workspace[]>({ queryKey: workspaceKeys.all }, (old) =>
        mapQueryArray(old, (workspace) =>
          workspace.id === ref.workspaceId ? { ...workspace, overview: snapshot.body || undefined } : workspace
        ),
      );
      break;
    }
    case "project-overview": {
      const ref = snapshot.ref;
      queryClient.setQueriesData<Project[]>({ queryKey: projectKeys.byWorkspace(ref.workspaceId) }, (old) =>
        mapQueryArray(old, (project) =>
          project.id === ref.projectId ? { ...project, overview: snapshot.body || undefined } : project
        ),
      );
      queryClient.setQueryData<Project | null>(projectKeys.detail(ref.workspaceId, ref.projectId), (old) =>
        old ? { ...old, overview: snapshot.body || undefined } : old,
      );
      break;
    }
  }
}
