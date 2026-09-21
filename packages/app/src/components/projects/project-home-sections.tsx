import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FileText,
  Plus,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ProjectCurrentTask,
  ProjectTimeline,
  ProjectTimelineEvent,
} from "@desk/core";
import { getScopedEntityKey } from "@desk/core";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/i18n/format";
import { isOverdue } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/patterns";
import { MiniTaskPostit } from "@/components/projects/mini-task-postit";
import { useCreateTask, useHighlightedTasks, useOpenTab } from "@/stores";

const CURRENT_TASK_LIMIT = 6;
const SCHEDULE_LIMIT = 5;
const HISTORY_LIMIT = 8;

/**
 * The mini post-it's metadata line: status on the left (the dot carries it), then
 * priority/due only when they exist. Kept to one short line so the note stays small.
 */
function postitMeta(
  t: (key: string) => string,
  task: ProjectCurrentTask
): string {
  const parts: string[] = [t(`entities.task.status.${task.status}`)];
  if (task.due) parts.push(formatLocaleDate(task.due, { day: "numeric", month: "short" }));
  if (task.priority) parts.push(t(`entities.task.priority.${task.priority}`));
  return parts.join(" · ");
}

export function CurrentWorkSection({
  workspaceId,
  projectId,
  tasks,
}: {
  workspaceId: string;
  projectId: string;
  tasks: ProjectCurrentTask[];
}) {
  const { t } = useTranslation();
  const { openTask } = useOpenTab();
  const { toggleHighlight } = useHighlightedTasks(workspaceId, projectId);
  const createTask = useCreateTask();
  const [newTitle, setNewTitle] = useState("");
  const shown = tasks.slice(0, CURRENT_TASK_LIMIT);
  const moreCount = tasks.length - shown.length;
  const boardLink = `/tasks?project=${projectId}`;

  const handleQuickAdd = async (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || createTask.isPending) return;
    try {
      await createTask.mutateAsync({ workspaceId, projectId, title });
      setNewTitle("");
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("errors.task.createFailed"));
    }
  };

  return (
    <section>
      <SectionLabel
        className="mb-2"
        end={(
          <Link to={boardLink} className="text-[11px] text-muted-foreground hover:text-foreground">
            {t("pages.projects.home.openBoard")}
          </Link>
        )}
      >
        {t("pages.projects.home.currentWork")}
      </SectionLabel>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-4 py-5 text-center text-sm text-muted-foreground">
          {t("pages.projects.home.noCurrentWork")}
        </p>
      ) : (
        // Tasks in a project read as small post-its (Diaspro: a post-it means a small
        // task note). Slight per-task tilt, clickable, nothing decorative.
        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((task) => (
            <div key={`${task.workspaceId}:${task.projectId}:${task.id}`} className="relative">
              <MiniTaskPostit
                id={task.id}
                title={task.title}
                status={task.status}
                meta={postitMeta(t, task)}
                metaTone={task.due && isOverdue(task.due) && task.status !== "done" ? "terracotta" : "default"}
                onClick={() => openTask(task)}
              />
              <button
                type="button"
                className={cn(
                  "absolute right-1.5 top-1.5 rounded p-1 text-[#1e1333]/35 transition-colors hover:bg-black/10 hover:text-[#1e1333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e1333]/40",
                  task.highlighted && "text-[#7a3f67]",
                )}
                onClick={() => toggleHighlight(getScopedEntityKey(task))}
                aria-label={t(task.highlighted ? "menus.taskContextMenu.removeHighlight" : "menus.taskContextMenu.highlightForFocus")}
              >
                <Star className={cn("size-3.5", task.highlighted && "fill-current")} />
              </button>
            </div>
          ))}
        </div>
      )}

      {moreCount > 0 && (
        <Link to={boardLink} className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground">
          {t("pages.projects.home.moreOnBoard", { count: moreCount })}
        </Link>
      )}

      <form onSubmit={handleQuickAdd} className="mt-3">
        <div className="relative">
          <Plus className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={t("pages.projects.home.quickAddPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </form>
    </section>
  );
}

const timelineIcons = {
  "project-created": Circle,
  "task-created": Circle,
  "task-completed": CheckCircle2,
  "task-due": Clock,
  meeting: FileText,
  "doc-created": FileText,
  "doc-updated": FileText,
} as const;

function TimelineRow({ event }: { event: ProjectTimelineEvent }) {
  const { t } = useTranslation();
  const { openTask, openDoc } = useOpenTab();
  const Icon = timelineIcons[event.kind];
  const canOpen = event.entityType && event.entityId;
  const open = () => {
    if (!canOpen) return;
    const entity = {
      id: event.entityId!,
      title: event.title,
      workspaceId: event.workspaceId,
      projectId: event.projectId,
    };
    if (event.entityType === "task") openTask(entity);
    else if (event.entityType === "doc") openDoc(entity);
  };

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={open}
      className={cn(
        "relative flex w-full gap-2.5 py-2 text-left",
        canOpen && "rounded-sm hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
      )}
    >
      <span className="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        <Icon className={cn("size-3 text-muted-foreground", event.overdue && "text-destructive")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t(`pages.projects.home.timeline.events.${event.kind}`)}
        </span>
        <span className="block truncate text-sm">{event.title}</span>
        <span className={cn("block text-[11px] text-muted-foreground", event.overdue && "text-destructive/80")}>
          {formatLocaleDate(event.at, { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </span>
    </button>
  );
}

function TimelineGroup({ title, events }: { title: string; events: ProjectTimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section>
      <SectionLabel className="mb-1">{title}</SectionLabel>
      <div className="relative before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-px before:bg-border/70">
        {events.map((event) => <TimelineRow key={event.id} event={event} />)}
      </div>
    </section>
  );
}

export function ProjectTimelineRail({ timeline }: { timeline: ProjectTimeline }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleSchedule = timeline.schedule.filter((event) => event.kind !== "meeting");
  const visibleHistory = timeline.history.filter((event) => event.kind !== "meeting");
  const schedule = expanded ? visibleSchedule : visibleSchedule.slice(0, SCHEDULE_LIMIT);
  const history = expanded ? visibleHistory : visibleHistory.slice(0, HISTORY_LIMIT);
  const hasMore = visibleSchedule.length > SCHEDULE_LIMIT || visibleHistory.length > HISTORY_LIMIT;

  return (
    <aside className="space-y-6 lg:border-l lg:border-border/60 lg:pl-7">
      <TimelineGroup title={t("pages.projects.home.timeline.schedule")} events={schedule} />
      <TimelineGroup title={t("pages.projects.home.timeline.history")} events={history} />
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-xs text-muted-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {t(expanded ? "pages.projects.home.timeline.showLess" : "pages.projects.home.timeline.showMore")}
        </Button>
      )}
    </aside>
  );
}
