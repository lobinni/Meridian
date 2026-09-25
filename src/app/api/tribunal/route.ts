import { NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { resolveAppConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Server-side read cache for the docket.
 *
 * The browser previously polled `get_all_cases` directly against the Studio
 * RPC every 12s — every request created a fresh `gen_call`, which each take
 * ~1.1–1.7s cold. This endpoint:
 *
 *  · runs in the server runtime (no per-user connection constraints),
 *  · reads `get_all_cases` once,
 *  · serves the cached docket for 4s (`stale-while-revalidate` semantics),
 *    making portal polling (~70 concurrent users) collapse into a single
 *    upstream call instead of N,
 *  · keeps the payload identical to `tribunal.getAllCases()` so the UI
 *    contract is unchanged.
 *
 * The result is a dramatically snappier feed without touching consensus.
 */

const CACHE_TTL_MS = 4_000;

let cache: { json: unknown[]; fetchedAt: number } | null = null;

function configClient(endpoint: string) {
  return createClient({ chain: studionet, endpoint });
}

export async function GET() {
  const config = resolveAppConfig();

  if (!config.hasLiveContract) {
    return NextResponse.json({ cases: [], config: { hasLiveContract: false } });
  }

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { cases: cache.json, cachedAt: cache.fetchedAt, fresh: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const client = configClient(config.rpcUrl);
    const cases = (await client.readContract({
      address: config.contractAddress as `0x${string}`,
      functionName: "get_all_cases",
      args: [],
    })) as unknown[];

    cache = { json: cases ?? [], fetchedAt: now };

    return NextResponse.json(
      { cases: cache.json, cachedAt: cache.fetchedAt, fresh: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Serve a recent cached snapshot if the upstream hiccups.
    if (cache) {
      return NextResponse.json(
        {
          cases: cache.json,
          cachedAt: cache.fetchedAt,
          fresh: false,
          degraded: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { cases: [], error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
