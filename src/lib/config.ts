/**
 * Meridian Tribunal — runtime configuration.
 *
 * Design: plain (non-prefixed) environment variables resolved **server-side**
 * and injected into the React tree through `<AppConfigProvider>`. Nothing
 * here uses the framework's public env prefix, so no value ever gets
 * inlined into the browser bundle — the app receives its configuration
 * through the server-rendered shell instead.
 *
 * `DEFAULT_CONFIG` pins the canonical Studionet deployment, so a deployment
 * with zero environment variables still runs live on-chain. Any of these can
 * be overridden with plain env vars (see `.env.example`):
 *
 *   CONTRACT_ADDRESS, GENLAYER_RPC_URL, GENLAYER_CHAIN_ID,
 *   GENLAYER_CHAIN_NAME, NATIVE_SYMBOL, EXPLORER_URL
 */

export interface AppConfig {
  contractAddress: string;
  rpcUrl: string;
  chainId: number;
  chainIdHex: string;
  networkLabel: string;
  nativeSymbol: string;
  explorerUrl: string;
  hasLiveContract: boolean;
}

/** Read a string env var, treating unset/blank as absent. */
function envStr(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  return value.length > 0 ? value : fallback;
}

/**
 * Parse the expected chain id. Env misconfiguration (unset, empty or
 * non-numeric) must never produce NaN — the fallback keeps wallet
 * payloads valid (`0xNaN` errors come from invalid values here).
 */
function parseChainId(raw: string | undefined): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

/* ------------------------------------------------------------------ */
/* Defaults — canonical live deployment on GenLayer Studionet          */
/* ------------------------------------------------------------------ */

const DEPLOYED_CONTRACT = "0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97";
const DEFAULT_RPC = "https://studio.genlayer.com/api";
const DEFAULT_CHAIN_ID = 61999;
const DEFAULT_LABEL = "Studionet";
const DEFAULT_SYMBOL = "GEN";
const DEFAULT_EXPLORER = "https://explorer-studio.genlayer.com";

export const DEFAULT_CONFIG: AppConfig = {
  contractAddress: DEPLOYED_CONTRACT,
  rpcUrl: DEFAULT_RPC,
  chainId: DEFAULT_CHAIN_ID,
  chainIdHex: `0x${DEFAULT_CHAIN_ID.toString(16)}`,
  networkLabel: DEFAULT_LABEL,
  nativeSymbol: DEFAULT_SYMBOL,
  explorerUrl: DEFAULT_EXPLORER,
  hasLiveContract: true,
};

/**
 * Resolve the effective configuration from the process environment.
 * Safe to call on the server (reads real env) and in the browser (every
 * lookup falls back to the defaults above).
 *
 * Setting CONTRACT_ADDRESS to an empty string intentionally disables
 * on-chain actions and surfaces a "contract not configured" notice —
 * the dApp never substitutes simulated data.
 */
export function resolveAppConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const chainId = parseChainId(env.CONTRACT_CHAIN_ID ?? env.GENLAYER_CHAIN_ID);
  const contractAddress = envStr(env.CONTRACT_ADDRESS, DEPLOYED_CONTRACT);
  return {
    contractAddress,
    rpcUrl: envStr(env.GENLAYER_RPC_URL, DEFAULT_RPC),
    chainId,
    chainIdHex: `0x${chainId.toString(16)}`,
    networkLabel: envStr(env.GENLAYER_CHAIN_NAME, DEFAULT_LABEL),
    nativeSymbol: envStr(env.NATIVE_SYMBOL, DEFAULT_SYMBOL),
    explorerUrl: envStr(env.EXPLORER_URL, DEFAULT_EXPLORER),
    hasLiveContract: contractAddress.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Static (env-independent) configuration                              */
/* ------------------------------------------------------------------ */

/** Faucet destinations surfaced on the faucet page. */
export const FAUCET_LINKS = [
  {
    title: "Studio Faucet",
    note: "Request test GEN directly from the Studio interface",
    url: "https://studio.genlayer.com/",
  },
  {
    title: "Faucet Portal",
    note: "Official drip endpoint for the builder program",
    url: "https://genlayer-faucet.vercel.app/",
  },
  {
    title: "Docs & Guides",
    note: "Network parameters, wallet setup and tooling",
    url: "https://docs.genlayer.com/",
  },
] as const;

/**
 * Polling cadence for read queries (ms). The cached feed endpoint absorbs
 * bursts, so the docket can poll aggressively while the expensive per-case
 * views back off — this is what keeps the page feeling alive without a
 * runaway `gen_call` storm.
 */
export const FEED_REFETCH_INTERVAL = 8_000;

/** Softer cadence for case-detail views (case + bet lookups). */
export const DETAIL_REFETCH_INTERVAL = 20_000;
