/**
 * AddBlockButton — Click to pick a workspace, creates a time-aware block.
 * Finds the largest available time gap in the day and fills it.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePlannerStore } from "@/stores/planner";
import { usePreferencesStore } from "@/stores/preferences";
import { useWorkspaces } from "@/stores/workspaces";
import { findLargestGap } from "@desk/core";
import type { WorkspaceBlock } from "@desk/core/types";

/** Workspace chooser rows — shared by the header "+" and by drag-to-create. */
export function WorkspacePickerList({
  onSelect,
}: {
  onSelect: (workspaceId: string) => void;
}) {
  const { data: workspaces = [] } = useWorkspaces();

  return (
    <>
      {workspaces.map((ws) => (
        <button
          key={ws.id}
          onClick={() => onSelect(ws.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/60 transition-colors"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: ws.color || "#64748b" }}
          />
          {ws.name}
        </button>
      ))}
    </>
  );
}

interface AddBlockButtonProps {
  date: string;
  weekOf: string;
  blocks?: WorkspaceBlock[];
  /** Compact mode — small icon only, for use in day headers */
  compact?: boolean;
}

export function AddBlockButton({ date, weekOf, blocks = [], compact }: AddBlockButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const addBlock = usePlannerStore((s) => s.addBlock);
  const workDayStartHour = usePreferencesStore((s) => s.workDayStartHour);
  const workDayEndHour = usePreferencesStore((s) => s.workDayEndHour);

  const handleSelect = (workspaceId: string) => {
    const workStart = workDayStartHour * 60;
    const workEnd = workDayEndHour * 60;

    // Find the largest available gap — need at least 30 min
    const gap = findLargestGap(blocks, workStart, workEnd);
    if (gap.end - gap.start < 30) {
      setOpen(false);
      return;
    }

    const startMinute = gap.start;
    const endMinute = gap.end;

    addBlock(weekOf, date, {
      id: crypto.randomUUID(),
      workspaceId,
      taskIds: [],
      startMinute,
      endMinute,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={
            compact
              ? "rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              : "whitespace-nowrap rounded border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground/75 transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          }
        >
          <Plus className={compact ? "h-3.5 w-3.5" : "h-3 w-3 inline-block mr-0.5"} />
          {!compact && t("common.buttons.add")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <WorkspacePickerList onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
