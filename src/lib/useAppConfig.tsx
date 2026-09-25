"use client";

/**
 * AppConfigProvider — carries the server-resolved runtime configuration
 * into the client tree, and constructs the contract bridge instance for it.
 *
 * The config object is resolved in the server layout (from plain, non-public
 * environment variables) and passed through the RSC payload, so nothing is
 * ever inlined into the browser bundle.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AppConfig } from "@/lib/config";
import { DEFAULT_CONFIG } from "@/lib/config";
import { MeridianTribunal } from "@/lib/contracts/MeridianTribunal";

const AppConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);
const TribunalContext = createContext<MeridianTribunal>(
  new MeridianTribunal(DEFAULT_CONFIG),
);

export function AppConfigProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: ReactNode;
}) {
  const tribunal = useMemo(() => new MeridianTribunal(config), [config]);
  return (
    <AppConfigContext.Provider value={config}>
      <TribunalContext.Provider value={tribunal}>
        {children}
      </TribunalContext.Provider>
    </AppConfigContext.Provider>
  );
}

/** Effective runtime configuration for the current app instance. */
export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}

/** The contract bridge instance bound to the active configuration. */
export function useTribunal(): MeridianTribunal {
  return useContext(TribunalContext);
}
