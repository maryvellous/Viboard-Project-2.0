export type Density = "compact" | "regular" | "relaxed";

export type PageWidth = "reading" | "settings" | "standard" | "wide" | "full";

/** Named layout widths keep comparable screens aligned as the app grows. */
export const pageWidthClasses: Record<PageWidth, string> = {
  reading: "max-w-4xl",
  settings: "max-w-[820px]",
  standard: "max-w-5xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

export const pageLayoutClasses = {
  horizontalPadding: "px-4 md:px-6",
  contentPadding: "p-4 md:p-6",
  compactContentPadding: "px-4 py-3 md:px-6",
} as const;

export const densityClasses: Record<Density, {
  header: string;
  section: string;
  content: string;
  card: string;
  row: string;
}> = {
  compact: {
    header: "h-12",
    section: "min-h-10",
    content: "p-3",
    card: "rounded-lg p-3",
    row: "h-8 px-2.5",
  },
  regular: {
    header: "h-14",
    section: "min-h-11",
    content: "p-4",
    card: "rounded-xl p-4",
    row: "h-9 px-3",
  },
  relaxed: {
    header: "h-14",
    section: "min-h-11",
    content: "p-5",
    card: "rounded-xl p-5",
    row: "h-10 px-3.5",
  },
};

export const appSurfaceClasses = {
  pageRoot: "flex flex-col h-full overflow-hidden bg-background",
  pageBody: "flex-1 min-h-0",
  card: "border border-border/80 bg-card text-card-foreground",
  denseCard: "border border-border/80 bg-card text-card-foreground",
  mutedSurface: "bg-muted/35",
} as const;

/** Shared interaction vocabulary: active navigation, selected content, then hover. */
export const interactionClasses = {
  activeNavigation: "bg-accent text-accent-foreground",
  selectedContent: "bg-accent/80 text-foreground",
  restingContent: "text-foreground/85 hover:bg-accent/55 hover:text-foreground",
  keyboardFocus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
} as const;
