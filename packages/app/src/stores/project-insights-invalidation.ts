import type { QueryClient } from "@tanstack/react-query";

export function invalidateProjectInsights(queryClient: QueryClient, workspaceId: string) {
  return queryClient.invalidateQueries({
    queryKey: ["projects", "workspace", workspaceId],
  });
}
