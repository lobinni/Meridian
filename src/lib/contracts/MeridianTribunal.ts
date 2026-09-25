"use client";

/**
 * MeridianTribunal — typed bridge between the UI and the deployed
 * intelligent contract on GenLayer.
 *
 * Every read and write goes through genlayer-js against the live network:
 * reads hit the RPC gateway directly, writes are signed by the connected
 * MetaMask account and awaited until consensus acceptance. No simulated
 * data exists anywhere in this path — the docket is exactly what the
 * contract stores.
 *
 * If `CONTRACT_ADDRESS` is ever unset, reads degrade to empty
 * results and writes fail fast with a clear configuration error.
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { AppConfig } from "@/lib/config";
import type { Bet, Case, Outcome } from "./types";

interface ProviderObject {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Wrap an EIP-1193 provider with console diagnostics. The returned object
 * preserves the standard `.request` method expected by viem/genlayer-js.
 */
function withDiagnostics(injected: ProviderObject): ProviderObject {
  return {
    request: async (args) => {
      const started = performance.now();
      try {
        const result = await injected.request(args);
        if (args.method !== "eth_chainId" && args.method !== "eth_accounts") {
          console.debug(
            `[genlayer] ${args.method} OK in ${Math.round(performance.now() - started)}ms`,
          );
        }
        return result;
      } catch (err) {
        const e = err as { code?: unknown; message?: unknown; data?: unknown };
        console.error(
          `[genlayer] ${args.method} FAILED — code=${String(e?.code)} message=${String(e?.message)}`,
          e?.data !== undefined ? e.data : "",
        );
        throw err;
      }
    },
  };
}

type GenLayerClient = ReturnType<typeof createClient>;

const WEI_PER_GEN = 10n ** 18n;

function toWei(amountGen: number): bigint {
  return BigInt(Math.round(amountGen * 1e6)) * (WEI_PER_GEN / 10n ** 6n);
}

/** Contract integers arrive as number | string of wei units. */
function fromChainAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const asString = String(value);
  if (!/^\d+$/.test(asString)) return Number(value) || 0;
  const wei = BigInt(asString);
  return Number(wei) / Number(WEI_PER_GEN);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeCase(raw: any): Case {
  const totals = raw?.bet_totals ?? {};
  return {
    id: Number(raw?.id ?? 0),
    plaintiff: String(raw?.plaintiff ?? ""),
    defendant: String(raw?.defendant ?? ""),
    title: String(raw?.title ?? ""),
    description: String(raw?.description ?? ""),
    evidence_urls: String(raw?.evidence_urls ?? ""),
    defense_text: String(raw?.defense_text ?? ""),
    defense_urls: String(raw?.defense_urls ?? ""),
    verdict: (raw?.verdict ?? "") as Case["verdict"],
    reasoning: String(raw?.reasoning ?? ""),
    severity: Number(raw?.severity ?? 0),
    status: (raw?.status ?? "OPEN") as Case["status"],
    escrow: raw?.escrow !== undefined ? fromChainAmount(raw.escrow) : undefined,
    bet_totals: raw?.bet_totals
      ? {
          guilty: fromChainAmount(totals.guilty),
          not_guilty: fromChainAmount(totals.not_guilty),
          insufficient_evidence: fromChainAmount(totals.insufficient_evidence),
        }
      : undefined,
  };
}

function normalizeBet(raw: any): Bet {
  return {
    exists: Boolean(raw?.exists),
    bettor: String(raw?.bettor ?? ""),
    case_id: Number(raw?.case_id ?? 0),
    outcome: String(raw?.outcome ?? ""),
    amount: fromChainAmount(raw?.amount),
    claimed: Boolean(raw?.claimed),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const EMPTY_BET = (caseId: number): Bet => ({
  exists: false,
  bettor: "",
  case_id: caseId,
  outcome: "",
  amount: 0,
  claimed: false,
});

const CONFIG_ERROR =
  "No contract address is configured — set CONTRACT_ADDRESS to enable on-chain actions";

export class MeridianTribunal {
  readonly mode: "live" | "unconfigured";
  readonly config: AppConfig;

  private contractAddress: `0x${string}`;
  private readClient: GenLayerClient | null = null;
  private writeClients = new Map<string, GenLayerClient>();

  constructor(config: AppConfig) {
    this.config = config;
    this.mode = config.hasLiveContract ? "live" : "unconfigured";
    this.contractAddress = config.contractAddress as `0x${string}`;
  }

  private getReadClient(): GenLayerClient {
    if (!this.readClient) {
      this.readClient = createClient({
        chain: studionet,
        endpoint: this.config.rpcUrl,
      });
    }
    return this.readClient;
  }

  private getWriteClient(account: string): GenLayerClient {
    const key = account.toLowerCase();
    let client = this.writeClients.get(key);
    if (!client) {
      const injected =
        typeof window !== "undefined" ? window.ethereum : undefined;
      const provider = injected ? withDiagnostics(injected) : undefined;
      client = createClient({
        chain: studionet,
        endpoint: this.config.rpcUrl,
        // String address on purpose: the SDK routes wallet RPC methods
        // (eth_sendTransaction et al.) to the injected provider only when
        // `config.account` is an address, and viem normalizes it into a
        // json-rpc account object (`client.account.address`) internally.
        account: account as `0x${string}`,
        // MetaMask (or any injected EIP-1193 provider) performs signing.
        ...(provider ? { provider: provider as never } : {}),
      });
      this.writeClients.set(key, client);
    }
    return client;
  }

  private ensureConfigured(): void {
    if (!this.config.hasLiveContract) throw new Error(CONFIG_ERROR);
  }

  /**
   * Guard every write with a live chain check. If MetaMask silently sits on
   * the wrong network, eth_sendTransaction would route the transaction to
   * that network's RPC — surfacing later as a confusing broadcast failure.
   */
  private async assertWalletOnChain(account: string): Promise<void> {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider) return; // non-browser callers (scripts) are validated by their own account

    const raw = (await provider.request({
      method: "eth_chainId",
    })) as string | null;
    const current = raw ? parseInt(raw, 16) : null;
    if (current !== null && current !== this.config.chainId) {
      throw new Error(
        `Wallet is on chain ${current} but the protocol expects ${this.config.chainId} — switch networks in the account menu before continuing`,
      );
    }
    void account;
  }

  /* ------------------------------- reads ------------------------------- */

  /**
   * The docket feed prefers the server-side cached endpoint
   * (`/api/tribunal`) — it turns N concurrent portal polls into one upstream
   * `gen_call` and keeps first paint near-instant on a warm cache.
   * Everywhere else (scripts, direct callers) it falls back to the RPC.
   */
  async getAllCases(): Promise<Case[]> {
    if (!this.config.hasLiveContract) return [];
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/tribunal", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { cases?: unknown[] };
          if (Array.isArray(body.cases)) {
            return body.cases.map(normalizeCase);
          }
        }
      } catch {
        // fall through to the direct RPC read below
      }
    }
    const raw = (await this.getReadClient().readContract({
      address: this.contractAddress,
      functionName: "get_all_cases",
      args: [],
    })) as unknown[];
    return (raw ?? []).map(normalizeCase);
  }

  async getCase(caseId: number): Promise<Case> {
    this.ensureConfigured();
    const raw = await this.getReadClient().readContract({
      address: this.contractAddress,
      functionName: "get_case",
      args: [caseId],
    });
    return normalizeCase(raw);
  }

  async getBet(caseId: number, bettor: string | null): Promise<Bet> {
    if (!this.config.hasLiveContract || !bettor) return EMPTY_BET(caseId);
    const raw = await this.getReadClient().readContract({
      address: this.contractAddress,
      functionName: "get_bet",
      args: [caseId, bettor],
    });
    return normalizeBet(raw);
  }

  async getAllBetsFor(bettor: string): Promise<Bet[]> {
    if (!this.config.hasLiveContract) return [];
    const cases = await this.getAllCases();
    // Parallel fetches — three browser connections to the RPC gateway are
    // plenty; a serial loop per case was the main source of "nothing loads"
    // on cold portals.
    const bets = await Promise.all(
      cases.map((c) => this.getBet(c.id, bettor).catch(() => null)),
    );
    return bets.filter((b): b is Bet => Boolean(b && b.exists));
  }

  /* ------------------------------ writes ------------------------------ */

  private async sendLive(
    account: string,
    functionName: string,
    args: unknown[],
    valueGen = 0,
  ): Promise<string> {
    this.ensureConfigured();
    await this.assertWalletOnChain(account);
    const client = this.getWriteClient(account);
    // Do NOT pass `account` here: the SDK consumes this parameter raw
    // (no viem normalization), while omitting it falls back to the
    // already-normalized `client.account` created above.
    const hash = await client.writeContract({
      address: this.contractAddress,
      functionName,
      args: args as never,
      value: toWei(valueGen),
    });
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
      interval: 6_000,
    });
    return hash;
  }

  async fileCase(
    plaintiff: string,
    defendant: string,
    title: string,
    description: string,
    evidenceUrls: string,
  ): Promise<number> {
    if (!title.trim() || !description.trim()) {
      throw new Error("Title and description are required");
    }
    if (!evidenceUrls.trim()) throw new Error("At least one evidence URL is required");
    if (defendant.trim().toLowerCase() === plaintiff.trim().toLowerCase()) {
      throw new Error("Cannot file a case against yourself");
    }
    await this.sendLive(plaintiff, "file_case", [
      defendant,
      title,
      description,
      evidenceUrls,
    ]);
    const cases = await this.getAllCases();
    return cases.reduce((max, c) => Math.max(max, c.id), 0);
  }

  async submitDefense(
    sender: string,
    caseId: number,
    defenseText: string,
    defenseUrls: string,
  ): Promise<void> {
    if (!defenseText.trim()) throw new Error("Defense text is required");
    await this.sendLive(sender, "submit_defense", [caseId, defenseText, defenseUrls]);
  }

  async placeBet(sender: string, caseId: number, outcome: Outcome, amountGen: number): Promise<void> {
    if (!Number.isFinite(amountGen) || amountGen <= 0) {
      throw new Error("Bet requires sending GEN tokens (value > 0)");
    }
    await this.sendLive(sender, "place_bet", [caseId, outcome], amountGen);
  }

  async judgeCase(sender: string, caseId: number): Promise<void> {
    await this.sendLive(sender, "judge_case", [caseId]);
  }

  async claimWinnings(sender: string, caseId: number): Promise<number> {
    // Mirror the contract's parimutuel math so the UI can display the exact
    // payout (the write receipt does not return the function value).
    const expected = await this.expectedPayout(sender, caseId);
    await this.sendLive(sender, "claim_winnings", [caseId]);
    return expected;
  }

  /**
   * Exact replica of `claim_winnings` payout math for a wallet, in GEN.
   * Returns 0 when the wallet holds no claimable winnings.
   */
  async expectedPayout(sender: string, caseId: number): Promise<number> {
    const [caseData, bet] = await Promise.all([
      this.getCase(caseId),
      this.getBet(caseId, sender),
    ]);
    if (!bet.exists || bet.claimed) return 0;
    if (caseData.status !== "JUDGED" || !caseData.verdict) return 0;

    const totals = caseData.bet_totals;
    if (!totals) return 0;
    const pool = totals.guilty + totals.not_guilty + totals.insufficient_evidence;
    const winningTotal =
      caseData.verdict === "GUILTY"
        ? totals.guilty
        : caseData.verdict === "NOT_GUILTY"
          ? totals.not_guilty
          : totals.insufficient_evidence;

    if (winningTotal > 0) {
      if (bet.outcome !== caseData.verdict) return 0;
      return (bet.amount * pool) / winningTotal;
    }
    // Nobody backed the verdict → full refund.
    return bet.amount;
  }
}

/** Instances are created per AppConfig by <AppConfigProvider>. */
