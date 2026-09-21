import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCurrentWorkspace, useWorkspaces } from "@/stores";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { DocsTreePane } from "@/components/docs/docs-tree-pane";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function DocsPage() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const { isLoading: workspacesLoading } = useWorkspaces();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialProjectId, setInitialProjectId] = useState(
    () => searchParams.get("project") || undefined,
  );

  useEffect(() => {
    if (!searchParams.has("project")) return;
    searchParams.delete("project");
    setSearchParams(searchParams, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const previousWorkspaceRef = useRef(currentWorkspaceId);
  useEffect(() => {
    const previous = previousWorkspaceRef.current;
    previousWorkspaceRef.current = currentWorkspaceId;
    if (previous === null || previous === currentWorkspaceId) return;
    setInitialProjectId(undefined);
  }, [currentWorkspaceId]);

  // Register the doc tree as the secondary sidebar slot for /docs.
  // The slot persists across tab switches (workspace tab ↔ doc tab) — only depends on the route.
  const pane = useMemo(
    () => (currentWorkspaceId ? (
      <DocsTreePane
        key={currentWorkspaceId}
        workspaceId={currentWorkspaceId}
        initialProjectId={initialProjectId}
      />
    ) : null),
    [currentWorkspaceId, initialProjectId],
  );
  useSecondarySidebar("/docs", pane);

  if (workspacesLoading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (!currentWorkspaceId || !currentWorkspace) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          title={t("pages.docs.selectWorkspaceTitle")}
          description={t("pages.docs.selectWorkspaceDescription")}
          className="h-full"
        />
      </div>
    );
  }

  // Main pane: shown only when the workspace tab is active. Opening a doc switches to a doc tab,
  // and `TabContent` then renders the editor here instead.
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="diaspro-accent-strip diaspro-accent-strip--sand" aria-hidden="true" />
      <div className="relative flex-1 min-h-0">
        <StatePanel
          variant="empty"
          display="inline"
          icon={FileText}
          title={t("pages.docs.selectDocTitle")}
          description={t("pages.docs.selectDocDescription")}
          className="h-full"
        />
        {/* Docs read as paper: one small cream note, not a cream page. */}
        <p className="diaspro-paper absolute bottom-5 left-1/2 max-w-sm -translate-x-1/2 px-3.5 py-2 text-center text-[11px] leading-relaxed shadow-[0_10px_22px_rgba(12,6,24,.28)]">
          {t("pages.docs.dropZone.hint")}
        </p>
      </div>
    </div>
  );
}
