
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { TaskCard } from "./task-card";
import { taskStatusColors, taskStatusLabels } from "@/lib/design-tokens";
import type { Task, TaskStatus } from "@desk/core/types";
import { cn } from "@/lib/utils";
import { getScopedEntityKey } from "@desk/core";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  showProject?: boolean;
  getProjectName?: (projectId: string) => string | null;
  /** Hide the column header (used when parent provides custom header) */
  hideHeader?: boolean;
  /** Whether this column is currently a drop target (for visual feedback) */
  isDropTarget?: boolean;
  /** Set of highlighted task IDs */
  highlightedTasks?: Set<string>;
  /** Callback to toggle highlight for a task */
  onToggleHighlight?: (taskId: string) => void;
  /** Workspace color for highlight background */
  workspaceColor?: string;
}

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  showProject,
  getProjectName,
  hideHeader,
  isDropTarget,
  highlightedTasks,
  onToggleHighlight,
  workspaceColor,
}: KanbanColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const label = taskStatusLabels[status];
  const dotColor = taskStatusColors[status];
  const showHighlight = isOver || isDropTarget;

  return (
    <div className={cn("flex flex-col h-full", !hideHeader && "min-w-[280px] w-[280px]")}>
      {/* Column header */}
      {!hideHeader && (
        <div className="mb-2 flex flex-shrink-0 items-center gap-2 px-1">
          <div className={cn("w-2 h-2 rounded-full", dotColor)} />
          <h3 className="text-sm font-medium text-foreground/90">{label}</h3>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      )}

      {/* Drop zone - flex-1 stretches to match siblings */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-lg p-1.5 transition-colors duration-150",
          showHighlight
            ? "bg-accent/60 ring-2 ring-ring/20"
            : "bg-muted/15"
        )}
      >
        <SortableContext
          items={tasks.map(getScopedEntityKey)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={getScopedEntityKey(task)}
                task={task}
                sortableId={getScopedEntityKey(task)}
                onClick={() => onTaskClick?.(task)}
                showProject={showProject}
                projectName={getProjectName?.(task.projectId)}
                isHighlighted={
                  highlightedTasks?.has(getScopedEntityKey(task))
                  || highlightedTasks?.has(task.id)
                }
                onToggleHighlight={
                  onToggleHighlight
                    ? () => onToggleHighlight(getScopedEntityKey(task))
                    : undefined
                }
                workspaceColor={workspaceColor}
              />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {t("pages.tasks.kanban.noTasks")}
          </div>
        )}
      </div>
    </div>
  );
}
