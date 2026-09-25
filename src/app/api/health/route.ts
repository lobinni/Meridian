import { db, DATABASE_CONFIGURED } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // Deployments without a database (e.g. Vercel) stay healthy — the dApp
  // itself is fully on-chain and does not need one.
  if (!DATABASE_CONFIGURED || !db) {
    return Response.json({ ok: true, database: "not-configured" });
  }

  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch {
    return Response.json({ ok: false, database: "unreachable" }, { status: 500 });
  }
}
