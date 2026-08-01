import { memo, useCallback } from "react";
import { Home, FileText, CheckSquare, Calendar, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabItem as TabItemType, TabType } from "@/stores/tabs";
import { TabContextMenu } from "./tab-context-menu";
import { useTranslation } from "react-i18next";

const TAB_ICONS: Record<TabType, React.ElementType> = {
  desk: Home,
  doc: FileText,
  task: CheckSquare,
  meeting: Calendar,
  email: Mail,
};

interface TabItemProps {
  tab: TabItemType;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onMiddleClick: () => void;
  onCloseOthers: () => void;
  hasOtherClosableTabs: boolean;
  workspaceColor?: string;
  showIcon?: boolean;
  isMainTab?: boolean;
}

export const TabItem = memo(function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onMiddleClick,
  onCloseOthers,
  hasOtherClosableTabs,
  workspaceColor,
  showIcon = true,
  isMainTab = false,
}: TabItemProps) {
  const { t } = useTranslation();
  const Icon = TAB_ICONS[tab.type];
  const isDeskTab = tab.type === "desk";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 && !tab.isPinned) {
        e.preventDefault();
        onMiddleClick();
      }
    },
    [tab.isPinned, onMiddleClick]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <TabContextMenu
      tab={tab}
      hasOtherClosableTabs={hasOtherClosableTabs}
      onClose={onClose}
      onCloseOthers={onCloseOthers}
    >
      <div
        className={cn(
          "group relative flex h-8 w-[150px] shrink-0 items-center rounded-t-lg border border-transparent text-xs transition-colors",
          isActive
            ? "bg-background text-foreground border-border/80 border-b-background shadow-[0_-1px_0_rgba(0,0,0,0.02)]"
            : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          isMainTab && "font-medium"
        )}
      >
        <button
          type="button"
          onClick={onActivate}
          onMouseDown={handleMouseDown}
          title={tab.title}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-t-lg pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
            tab.isPinned ? "pr-3" : "pr-8",
          )}
        >
          {isDeskTab && workspaceColor && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: workspaceColor }}
            />
          )}
          {showIcon && <Icon className="size-3.5 shrink-0" />}
          <span className="flex-1 truncate">{tab.title}</span>
          {tab.isDirty && (
            <span className="shrink-0 text-[11px] leading-none text-muted-foreground/75">•</span>
          )}
        </button>

        {!tab.isPinned && (
          <button
            type="button"
            onClick={handleCloseClick}
            title={t("editors.shared.closeTab")}
            aria-label={t("editors.shared.closeTab")}
            className={cn(
              "absolute right-1 flex size-6 items-center justify-center rounded text-muted-foreground transition-[opacity,color,background-color] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive ? "opacity-75" : "opacity-0 group-hover:opacity-75 focus-visible:opacity-100",
            )}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
});
