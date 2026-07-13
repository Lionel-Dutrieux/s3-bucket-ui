import { queryOptions } from "@tanstack/react-query";
import { fetchSourceConfig } from "@/features/sources/api/client";

/** queryOptions factory for the sources feature — keys live with fetchers. */
export const sourcesQueries = {
  all: () => ["sources"] as const,
  config: (sourceId: string) =>
    queryOptions({
      queryKey: [...sourcesQueries.all(), "config", sourceId],
      queryFn: () => fetchSourceConfig(sourceId),
    }),
};
