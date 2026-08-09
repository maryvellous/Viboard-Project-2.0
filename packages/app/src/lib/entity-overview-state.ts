export type EntityOverviewMode = "loading" | "load-error" | "missing" | "ready";

export function resolveEntityOverviewMode(input: {
  hasState: boolean;
  isLoading: boolean;
  loadError: unknown;
  fileDeleted: boolean;
}): EntityOverviewMode {
  if (input.loadError) return "load-error";
  if (input.fileDeleted) return "missing";
  if (input.isLoading || !input.hasState) return "loading";
  return "ready";
}
