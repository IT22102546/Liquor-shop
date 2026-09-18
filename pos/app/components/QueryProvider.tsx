"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 45_000,
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
        mutations: {
          retry: 0,
        },
      },
    }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}