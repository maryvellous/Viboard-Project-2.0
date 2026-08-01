import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  pageLayoutClasses,
  pageWidthClasses,
  type PageWidth,
} from "@/lib/enterprise-ui";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  center?: ReactNode;
  secondary?: ReactNode;
  width?: PageWidth;
  className?: string;
}

/** Stable page chrome shared by workspace-level screens. */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  center,
  secondary,
  width = "full",
  className,
}: PageHeaderProps) {
  const contentWidth = pageWidthClasses[width];

  return (
    <header className={cn("shrink-0 border-b border-border/70 bg-background", className)}>
      <div
        className={cn(
          "mx-auto grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3",
          pageLayoutClasses.horizontalPadding,
          contentWidth,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="min-w-0">{center}</div>
        <div className="flex min-w-0 items-center justify-end gap-2">{actions}</div>
      </div>
      {secondary && (
        <div className="border-t border-border/50">
          <div
            className={cn(
              "mx-auto flex min-h-11 w-full flex-wrap items-center gap-3 py-2",
              pageLayoutClasses.horizontalPadding,
              contentWidth,
            )}
          >
            {secondary}
          </div>
        </div>
      )}
    </header>
  );
}
