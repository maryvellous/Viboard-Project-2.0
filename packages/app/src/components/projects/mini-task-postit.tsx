/**
 * Mini task post-it — the Diaspro way to show a task INSIDE a project.
 *
 * Semantic rule: a post-it means "a small task note", nothing else. This is used in
 * project context only (project overview, project cards); the global Tasks page keeps
 * its functional list/kanban. It follows `diaspro-ui/postit` (paper, tape, slight
 * tilt) at small size: readable, obviously clickable, not a decoration.
 */
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@desk/core/types";

/** Small deterministic tilt — same task always gets the same angle. */
function tiltFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000;
  }
  return `${((hash % 7) - 3) / 3}deg`;
}

const statusDot: Record<TaskStatus, string> = {
  backlog: "#9d85c6",
  todo: "#bc957d",
  doing: "#a5c4dc",
  waiting: "#8f5a5a",
  done: "#98a78a",
};

interface MiniTaskPostitProps {
  id: string;
  title: string;
  status: TaskStatus;
  /** Right-hand metadata line, e.g. a formatted due date. Omit to hide the row. */
  meta?: string;
  /** Urgent items (overdue) get a terracotta meta line. */
  metaTone?: "default" | "terracotta";
  onClick?: () => void;
  className?: string;
}

export function MiniTaskPostit({
  id,
  title,
  status,
  meta,
  metaTone = "default",
  onClick,
  className,
}: MiniTaskPostitProps) {
  const body = (
    <>
      <span className="diaspro-postit-task__title">{title}</span>
      <span
        className={cn(
          "diaspro-postit-task__meta",
          metaTone === "terracotta" && "text-[#8f5a5a]"
        )}
      >
        <span
          className="diaspro-postit-task__dot"
          style={{ backgroundColor: statusDot[status] }}
        />
        {meta}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div
        className={cn("diaspro-postit-task", `diaspro-postit-task--${status}`, className)}
        style={{ ["--diaspro-postit-tilt" as string]: tiltFor(id) }}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("diaspro-postit-task", `diaspro-postit-task--${status}`, className)}
      style={{ ["--diaspro-postit-tilt" as string]: tiltFor(id) }}
    >
      {body}
    </button>
  );
}
