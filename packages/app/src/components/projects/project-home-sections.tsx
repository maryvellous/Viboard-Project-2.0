import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FileText,
  Loader2,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DueLabel } from "@/components/ui/due-label";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { SectionLabel } from "@/components/patterns";
import { useCreateTask, useHighlightedTasks, useOpenTab } from "@/stores";

const CURRENT_TASK_LIMIT = 6;
const SCHEDULE_LIMIT = 5;
const HISTORY_LIMIT = 8;

const statusIcons = {
  todo: Circle,
  doing: Loader2,
  waiting: Clock,
} as const;

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
        <div className="-mx-2 divide-y divide-border/40">
          {shown.map((task) => {
            const Icon = statusIcons[task.status as keyof typeof statusIcons];
            return (
              <div key={`${task.workspaceId}:${task.projectId}:${task.id}`} className="group flex items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => openTask(task)}
                >
                  <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", task.status === "doing" && "text-primary")} />
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  {task.priority && <PriorityIcon priority={task.priority} className="shrink-0" />}
                  <DueLabel due={task.due} status={task.status} showUpcoming />
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    task.highlighted && "text-brand-accent",
                  )}
                  onClick={() => toggleHighlight(getScopedEntityKey(task))}
                  aria-label={t(task.highlighted ? "menus.taskContextMenu.removeHighlight" : "menus.taskContextMenu.highlightForFocus")}
                >
                  <Star className={cn("size-3.5", task.highlighted && "fill-current")} />
                </button>
              </div>
            );
          })}
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
  meeting: Calendar,
  "doc-created": FileText,
  "doc-updated": FileText,
} as const;

function TimelineRow({ event }: { event: ProjectTimelineEvent }) {
  const { t } = useTranslation();
  const { openTask, openDoc, openMeeting } = useOpenTab();
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
    else openMeeting(entity);
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
  const schedule = expanded ? timeline.schedule : timeline.schedule.slice(0, SCHEDULE_LIMIT);
  const history = expanded ? timeline.history : timeline.history.slice(0, HISTORY_LIMIT);
  const hasMore = timeline.schedule.length > SCHEDULE_LIMIT || timeline.history.length > HISTORY_LIMIT;

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
