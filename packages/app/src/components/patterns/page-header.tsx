import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  pageLayoutClasses,
  pageWidthClasses,
  type PageWidth,
} from "@/lib/enterprise-ui";

/**
 * Per-page accent colour — the Diaspro grammar, one deliberate hue per screen:
 * Tasks → blue, Projects → sand, Docs → warm-sand, Meetings → sage,
 * Planner → lavender, Dashboard → plum.
 */
export type PageAccent = "blue" | "sage" | "sand" | "lavender" | "plum" | "terracotta";

// Literal classes (not interpolated) so Tailwind keeps them in the build.
const accentIconClasses: Record<PageAccent, string> = {
  blue: "text-[#a5c4dc]",
  sage: "text-[#98a78a]",
  sand: "text-[#e8d19e]",
  lavender: "text-[#9d85c6]",
  plum: "text-[#c98cb4]",
  terracotta: "text-[#cf9494]",
};

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  center?: ReactNode;
  secondary?: ReactNode;
  width?: PageWidth;
  /** Page colour. Omitted → the neutral multi-stop strip. */
  accent?: PageAccent;
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
  accent,
  className,
}: PageHeaderProps) {
  const contentWidth = pageWidthClasses[width];

  return (
    <header className={cn("shrink-0 border-b border-border/70 bg-background", className)}>
      {/* Diaspro chromatic break: 2px signature line carrying the page's colour, so
          screens don't open on another flat violet band. `accent` also tints the icon. */}
      <div
        className={cn("diaspro-accent-strip", accent && `diaspro-accent-strip--${accent}`)}
        aria-hidden="true"
      />
      <div
        className={cn(
          "mx-auto grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3",
          pageLayoutClasses.horizontalPadding,
          contentWidth,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <Icon className={cn("size-4 shrink-0", accent ? accentIconClasses[accent] : "text-muted-foreground")} />
          )}
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
