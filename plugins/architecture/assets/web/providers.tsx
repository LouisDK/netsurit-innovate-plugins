/**
 * TanStack Query Client Provider Template
 *
 * This is a reference template. Copy to apps/web/components/providers.tsx
 * and adapt defaults to your application's caching needs.
 *
 * TanStack Query (React Query) is the recommended default for
 * client-side server state management.
 * See implementation-defaults.md for the data fetching recommendation.
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 30 seconds
            staleTime: 30_000,
            // Retry failed queries once
            retry: 1,
            // Refetch on window focus for interactive apps
            refetchOnWindowFocus: true,
          },
          mutations: {
            // No default retry for mutations
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
