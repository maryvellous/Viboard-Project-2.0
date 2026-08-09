import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckSquare, Clock, FileText, FolderKanban } from "lucide-react";
import {
  getRecentItems,
  getScopedEntityKey,
  search,
  type SearchItemType,
  type SearchResult,
} from "@desk/core";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { AIBadge } from "@/components/ui/ai-badge";
import { useSearchIndexState } from "@/hooks/use-search-index";
import { searchIndexController } from "@/lib/search-index-controller";
import { buildSearchSnippet, splitHighlightedText } from "@/lib/search-presentation";
import { confirmUnsavedChanges } from "@/lib/unsaved-changes-guard";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigationStore } from "@/stores/navigation";
import { useOpenTab } from "@/stores/tabs";

type SearchScope = "all" | "workspace";

const TYPE_ICONS: Record<SearchItemType, React.ReactNode> = {
  task: <CheckSquare className="size-4" />,
  doc: <FileText className="size-4" />,
  meeting: <Calendar className="size-4" />,
  project: <FolderKanban className="size-4" />,
};

const TYPE_LABEL_KEYS: Record<SearchItemType, string> = {
  task: "search.globalSearch.types.task",
  doc: "search.globalSearch.types.doc",
  meeting: "search.globalSearch.types.meeting",
  project: "search.globalSearch.types.project",
};

export function openGlobalSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const currentWorkspaceId = useNavigationStore((state) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);
  const indexState = useSearchIndexState();
  const { openTask, openDoc, openMeeting } = useOpenTab();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) void searchIndexController.refresh();
  }, [open]);

  useEffect(() => {
    if (!indexState.hasUsableIndex) {
      setResults([]);
      return;
    }
    const workspaceId = scope === "workspace" ? currentWorkspaceId ?? undefined : undefined;
    setResults(
      query.trim()
        ? search(query, { limit: 10, workspaceId })
        : getRecentItems(8, undefined, workspaceId),
    );
  }, [query, scope, currentWorkspaceId, indexState.revision, indexState.hasUsableIndex]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setScope("all");
    }
  }, [open]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const { item } = result;
      switch (item.type) {
        case "task":
          setOpen(false);
          openTask(item);
          break;
        case "doc":
          setOpen(false);
          openDoc(item);
          break;
        case "meeting":
          setOpen(false);
          openMeeting(item);
          break;
        case "project": {
          if (item.workspaceId !== currentWorkspaceId) {
            setCurrentWorkspaceId(item.workspaceId);
            if (useNavigationStore.getState().currentWorkspaceId !== item.workspaceId) return;
          } else if (!confirmUnsavedChanges()) {
            return;
          }
          setOpen(false);
          navigate(`/projects?open=${encodeURIComponent(item.id)}`);
          break;
        }
      }
    },
    [currentWorkspaceId, navigate, openDoc, openMeeting, openTask, setCurrentWorkspaceId],
  );

  const emptyMessage = !indexState.hasUsableIndex
    ? indexState.status === "error"
      ? t("search.globalSearch.unavailable")
      : t("search.globalSearch.buildingIndex")
    : t("search.globalSearch.noResults");

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder={t("search.globalSearch.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <div
        role="group"
        aria-label={t("search.globalSearch.scope.label")}
        className="flex items-center gap-1 border-b px-3 py-2"
      >
        {(["all", "workspace"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={value === "workspace" && !currentWorkspaceId}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              scope === value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {t(`search.globalSearch.scope.${value}`)}
          </button>
        ))}
      </div>
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup
            heading={query.trim()
              ? t("search.globalSearch.resultsHeading")
              : t("search.globalSearch.recentHeading")}
          >
            {results.map((result) => (
              <SearchResultItem
                key={`${result.item.type}-${getScopedEntityKey(result.item)}`}
                result={result}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const { item } = result;
  const snippet = buildSearchSnippet(result);
  const titleSegments = useMemo(() => {
    const titleMatch = result.matches?.find((match) => match.key === "title");
    return splitHighlightedText(
      item.title,
      titleMatch?.indices.map(([start, end]) => [start, end + 1]) ?? [],
    );
  }, [item.title, result.matches]);
  const context = [
    item.workspaceName,
    item.type === "project" ? undefined : item.projectName,
    t(TYPE_LABEL_KEYS[item.type]),
  ].filter(Boolean).join(" › ");

  return (
    <CommandItem
      value={`${item.type}-${getScopedEntityKey(item)}-${item.title}`}
      onSelect={() => onSelect(result)}
      className="flex items-start gap-3 py-2"
    >
      <span className="mt-0.5 text-muted-foreground">{TYPE_ICONS[item.type]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {titleSegments.map((segment, index) => segment.highlighted ? (
              <mark key={index} className="bg-transparent font-semibold text-foreground">{segment.text}</mark>
            ) : segment.text)}
          </span>
          {item.author === "ai" && <AIBadge />}
          {item.status && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {item.status}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{context}</div>
        {snippet && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
            {snippet.segments.map((segment, index) => segment.highlighted ? (
              <mark key={index} className="bg-transparent font-semibold text-foreground/80">{segment.text}</mark>
            ) : segment.text)}
          </div>
        )}
      </div>
      {item.due && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {formatDate(item.due)}
        </span>
      )}
    </CommandItem>
  );
}

export default GlobalSearch;
