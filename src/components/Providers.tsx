"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";
import { AppConfigProvider } from "@/lib/useAppConfig";
import type { AppConfig } from "@/lib/config";

export default function Providers({
  config,
  children,
}: {
  config: AppConfig;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <AppConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { borderRadius: 0 },
            }}
          />
        </WalletProvider>
      </QueryClientProvider>
    </AppConfigProvider>
  );
}
