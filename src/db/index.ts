import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Optional database wiring.
 *
 * Meridian Tribunal is a fully on-chain dApp — it does not require a
 * database. `DATABASE_URL` is only used by the health endpoint when present,
 * so this module must import cleanly even when the variable is absent
 * (e.g. static hosting / Vercel without a provisioned database).
 */

const databaseUrl = process.env.DATABASE_URL;

export const DATABASE_CONFIGURED = Boolean(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = DATABASE_CONFIGURED
  ? (globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({ connectionString: databaseUrl }))
  : undefined;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = pool ? drizzle(pool) : null;
