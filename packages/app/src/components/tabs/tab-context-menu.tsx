
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { TabItem } from "@/stores/tabs";
import { isMacOS } from "@desk/core";
import { getKeyboardShortcutLabel } from "@/lib/keyboard-shortcuts";

interface TabContextMenuProps {
  tab: TabItem;
  children: React.ReactNode;
  hasOtherClosableTabs: boolean;
  onClose: () => void;
  onCloseOthers: () => void;
}

export function TabContextMenu({
  tab,
  children,
  hasOtherClosableTabs,
  onClose,
  onCloseOthers,
}: TabContextMenuProps) {
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCloseOthers = useCallback(() => {
    onCloseOthers();
  }, [onCloseOthers]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {!tab.isPinned && (
          <ContextMenuItem onClick={handleClose}>
            {t("menus.tabContextMenu.close")}
            <ContextMenuShortcut>{getKeyboardShortcutLabel("close-tab", isMacOS())}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={!hasOtherClosableTabs}
        >
          {t("menus.tabContextMenu.closeOthers")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
