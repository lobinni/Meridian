/**
 * Meridian Tribunal — docket seeding script.
 *
 * Files the sample disputes from `samples/cases.json` onto the deployed
 * contract so the docket can be exercised end-to-end on Studionet without
 * manual data entry.
 *
 * Usage
 * -----
 *   DEPLOYER_PRIVATE_KEY=0x…  npx tsx deploy/seed.ts
 *
 * Optional environment:
 *   SECONDARY_PRIVATE_KEY   Account used as the defendant; when provided,
 *                           samples that include a defense are advanced to
 *                           DEFENSE state so verdicts can be summoned at once.
 *   SEED_DEFENDANT_ADDRESS  Defendant address when no secondary key is given
 *                           (defaults to the zero-vanity dead address).
 *   GENLAYER_RPC_URL        RPC endpoint (default: studio gateway)
 *   CONTRACT_ADDRESS        Override the deployed contract address.
 *   SEED_BETS               "1" to also place sample stakes from extra
 *                           freshly generated (funded-by-deployer) accounts.
 *
 * The script is idempotent: samples whose title already exists on the
 * docket are skipped.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SAMPLES_PATH = join(ROOT, "samples", "cases.json");

const RPC_URL = process.env.GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS ??
  "0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97") as `0x${string}`;

const pack = JSON.parse(readFileSync(SAMPLES_PATH, "utf8")) as {
  cases: Array<{
    slug: string;
    stage: string;
    title: string;
    description: string;
    evidence_urls: string[];
    defense: { text: string; evidence_urls: string[] } | null;
    suggested_stakes: { outcome: string; gen: number }[];
  }>;
};

function clientFor(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, endpoint: RPC_URL, account });
}

async function waitAccepted(client: ReturnType<typeof clientFor>, hash: unknown) {
  await client.waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 5_000,
  });
}

async function docket(client: ReturnType<typeof clientFor>) {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_all_cases",
    args: [],
  })) as any[];
}

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    console.error("Missing DEPLOYER_PRIVATE_KEY (the plaintiff / funding account).");
    process.exit(1);
  }

  const plaintiff = createAccount(deployerKey as `0x${string}`);
  const plaintiffClient = clientFor(plaintiff);

  let defendantClient: ReturnType<typeof clientFor> | null = null;
  let defendantAccount: ReturnType<typeof createAccount> | null = null;
  let defendantAddress: `0x${string}`;
  if (process.env.SECONDARY_PRIVATE_KEY) {
    defendantAccount = createAccount(process.env.SECONDARY_PRIVATE_KEY as `0x${string}`);
    defendantClient = clientFor(defendantAccount);
    defendantAddress = defendantAccount.address;
  } else {
    defendantAddress = (process.env.SEED_DEFENDANT_ADDRESS ??
      "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
    console.warn(
      "No SECONDARY_PRIVATE_KEY — samples will be filed against",
      defendantAddress,
      "and left in OPEN state (no defense possible from that address).",
    );
  }

  console.log(`▸ RPC:       ${RPC_URL}`);
  console.log(`▸ Contract:  ${CONTRACT_ADDRESS}`);
  console.log(`▸ Plaintiff: ${plaintiff.address}`);
  console.log(`▸ Defendant: ${defendantAddress}`);
  console.log(`▸ Samples:   ${pack.cases.length}`);

  const existing = await docket(plaintiffClient);
  const existingTitles = new Set(existing.map((c) => String(c.title)));

  for (const sample of pack.cases) {
    if (existingTitles.has(sample.title)) {
      console.log(`• skip (already on docket): ${sample.title}`);
      continue;
    }

    process.stdout.write(`▸ filing: ${sample.title} … `);
    try {
      const hash = await plaintiffClient.writeContract({
        account: plaintiff as never,
        address: CONTRACT_ADDRESS,
        functionName: "file_case",
        args: [
          defendantAddress,
          sample.title,
          sample.description,
          sample.evidence_urls.join(", "),
        ] as never,
        value: 0n,
      });
      await waitAccepted(plaintiffClient, hash);
      console.log("OK");

      if (sample.defense && defendantClient) {
        process.stdout.write(`  ↳ defense … `);
        const defHash = await defendantClient.writeContract({
          account: defendantAccount as never,
          address: CONTRACT_ADDRESS,
          functionName: "submit_defense",
          args: [
            (await docket(plaintiffClient)).length - 1,
            sample.defense.text,
            sample.defense.evidence_urls.join(", "),
          ] as never,
          value: 0n,
        });
        await waitAccepted(defendantClient, defHash);
        console.log("OK");
      }
    } catch (err) {
      console.log(`FAILED (${(err as Error).message})`);
    }
  }

  const finalDocket = await docket(plaintiffClient);
  console.log(`\n✔ Seed complete — ${finalDocket.length} case(s) now on the docket.`);
  console.log(
    `  explorer: https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`,
  );
  console.log(
    "  next: stake outcomes from a third wallet, then summon verdicts from the UI.",
  );
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
