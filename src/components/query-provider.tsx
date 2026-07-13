"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState (not a module-level client) so each request in SSR gets its own
  // cache and HMR doesn't leak queries across reloads.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dialog reads are one-shot lookups against bucket APIs — a focus
            // switch shouldn't re-issue HEAD/GET requests.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
