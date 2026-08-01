/**
 * TimeGrid — Left-side time axis with hour labels for the week view.
 * Renders hour labels aligned to the grid rows.
 */

import { minutesToTime } from "@desk/core";

interface TimeGridProps {
  gridStartMinute: number;
  gridEndMinute: number;
  slotHeight: number;
}

export function TimeGrid({ gridStartMinute, gridEndMinute, slotHeight }: TimeGridProps) {
  const totalSlots = (gridEndMinute - gridStartMinute) / 30;
  const hours: number[] = [];

  // Collect full-hour marks within the grid range
  for (let m = gridStartMinute; m <= gridEndMinute; m += 30) {
    if (m % 60 === 0) hours.push(m);
  }

  return (
    <div
      className="shrink-0 w-12 relative select-none"
      style={{ height: totalSlots * slotHeight }}
    >
      {hours.map((minute) => {
        const top = ((minute - gridStartMinute) / 30) * slotHeight;
        return (
          <span
            key={minute}
            className="absolute right-2 -translate-y-1/2 text-xs leading-none text-muted-foreground"
            style={{ top }}
          >
            {minutesToTime(minute)}
          </span>
        );
      })}
    </div>
  );
}
