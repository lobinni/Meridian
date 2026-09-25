/**
 * Meridian Tribunal — contract deployment script.
 *
 * Deploys `contracts/meridian_tribunal.py` to the configured GenLayer
 * network and writes the resulting address into `.env.local`, so the
 * frontend starts talking to the fresh deployment immediately.
 *
 * Usage
 * -----
 *   DEPLOYER_PRIVATE_KEY=0x… npx tsx deploy/deploy.ts
 *
 * Optional environment:
 *   GENLAYER_RPC_URL   RPC endpoint          (default: studio gateway)
 *   TARGET_ENV         studionet | localnet  (default: studionet)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { localnet, studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTRACT_PATH = join(ROOT, "contracts", "meridian_tribunal.py");
const ENV_PATH = join(ROOT, ".env.local");

const NETWORK = (process.env.TARGET_ENV ?? "studionet").toLowerCase();
const RPC_URL = process.env.GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractAddress(receipt: any): string | null {
  const candidates = [
    receipt?.data?.contract_address,
    receipt?.data?.contractAddress,
    receipt?.contract_address,
    receipt?.to_address,
    receipt?.recipient,
    receipt?.txDataDecoded?.contract_address,
    receipt?.consensus_data?.leader_receipt?.contract_address,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x")) return c;
  }
  // Deep-scan fallback: first 0x-address-shaped string anywhere.
  const stack: any[] = [receipt];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node === "string" && /^0x[a-fA-F0-9]{40}$/.test(node)) return node;
    if (node && typeof node === "object") {
      for (const v of Object.values(node)) stack.push(v);
    }
  }
  return null;
}

function upsertEnv(key: string, value: string) {
  let contents = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  if (contents.includes(`${key}=`)) {
    contents = contents.replace(new RegExp(`^${key}=.*$`, "m"), line);
  } else {
    contents = `${contents.trimEnd()}\n${line}\n`;
  }
  writeFileSync(ENV_PATH, contents);
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error(
      "Missing DEPLOYER_PRIVATE_KEY. Provide a funded account for the target network.",
    );
    process.exit(1);
  }

  const chain = NETWORK === "localnet" ? localnet : studionet;
  const account = createAccount(privateKey as `0x${string}`);
  const client = createClient({ chain, endpoint: RPC_URL, account });

  const code = readFileSync(CONTRACT_PATH, "utf8");
  console.log(`▸ Network:  ${NETWORK} (${RPC_URL})`);
  console.log(`▸ Deployer: ${account.address}`);
  console.log(`▸ Contract: ${CONTRACT_PATH}`);
  console.log("▸ Submitting deployment — this can take a minute on live networks…");

  const hash = await client.deployContract({
    code,
    args: [],
  });

  console.log(`▸ Deploy transaction: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5_000,
  });

  const address = extractAddress(receipt);
  if (!address) {
    console.error("Could not locate the deployed contract address in the receipt.");
    console.error("Inspect the receipt above and set CONTRACT_ADDRESS manually.");
    process.exit(1);
  }

  upsertEnv("CONTRACT_ADDRESS", address);
  upsertEnv("GENLAYER_RPC_URL", RPC_URL);

  console.log("✔ Meridian Tribunal deployed");
  console.log(`  address: ${address}`);
  console.log(`  wrote CONTRACT_ADDRESS to .env.local`);
  console.log("  restart the frontend to pick up the new address.");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
