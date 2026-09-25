"use client";

/**
 * Low-level wallet + network helpers.
 *
 * Wraps the injected MetaMask provider. Nothing here reads the environment
 * directly — the expected network is passed in as a {@link NetworkSpec}
 * (built from the server-resolved {@link AppConfig}), so zero public-prefix
 * variables are needed anywhere in the client bundle.
 */

import type { AppConfig } from "@/lib/config";

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Everything the wallet plumbing needs to know about the expected chain.
 * Derived from AppConfig — see {@link networkSpecOf}.
 */
export interface NetworkSpec {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  nativeSymbol: string;
}

/**
 * Build the wallet-facing network spec. The chain registration uses the
 * network's canonical parameters (name, currency, RPC) so wallets never
 * reject `wallet_addEthereumChain` as a mismatch for the same chain id.
 */
export function networkSpecOf(config: AppConfig): NetworkSpec {
  return {
    chainId: config.chainId,
    chainIdHex: config.chainIdHex,
    chainName: "Genlayer Studio Network",
    rpcUrl: config.rpcUrl,
    nativeSymbol: config.nativeSymbol,
  };
}

/** MetaMask `wallet_addEthereumChain` payload for a spec. */
export function addChainParams(spec: NetworkSpec) {
  return {
    chainId: spec.chainIdHex,
    chainName: spec.chainName,
    nativeCurrency: {
      name: spec.nativeSymbol === "GEN" ? "GEN Token" : spec.nativeSymbol,
      symbol: spec.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: [spec.rpcUrl],
    blockExplorerUrls: [] as string[],
  };
}

export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.ethereum?.isMetaMask);
}

export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

/** Extract a human-readable message from any EIP-1193-style error shape. */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      error?: { message?: unknown };
      data?: { message?: unknown };
      code?: unknown;
      reason?: unknown;
    };
    const msg =
      (typeof e.message === "string" && e.message) ||
      (typeof e.error?.message === "string" && e.error.message) ||
      (typeof e.data?.message === "string" && e.data.message) ||
      (typeof e.reason === "string" && e.reason) ||
      null;
    if (msg) return e.code !== undefined ? `${msg} (code ${String(e.code)})` : msg;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** EIP-1193 error code, whatever the concrete error shape is. */
function codeOf(err: unknown): number | null {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "number") return code;
    if (typeof code === "string") return parseInt(code, 10);
  }
  return null;
}

/** Request account access from MetaMask. */
export async function requestAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask is not installed");

  try {
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return accounts;
  } catch (err: unknown) {
    if (codeOf(err) === 4001) throw new Error("Connection request was rejected");
    throw new Error(`Failed to connect: ${messageOf(err)}`);
  }
}

/** Read currently-permitted accounts without prompting. */
export async function getAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();
  if (!provider) return [];
  try {
    return (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    return [];
  }
}

/** Current chain id (hex) reported by the wallet. */
export async function getCurrentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();
  if (!provider) return null;
  try {
    return (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    return null;
  }
}

/** Is the wallet currently on the expected chain id (decimal)? */
export async function isOnExpectedChain(chainId: number): Promise<boolean> {
  const current = await getCurrentChainId();
  if (!current) return false;
  return parseInt(current, 16) === chainId;
}

/** Add / switch the wallet to the expected network. */
export async function switchToNetwork(spec: NetworkSpec): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask is not installed");

  const targetChainId = spec.chainIdHex;

  const readChain = async (): Promise<string | null> => {
    try {
      return (await provider.request({ method: "eth_chainId" })) as string;
    } catch {
      return null;
    }
  };

  const isTarget = (id: string | null): boolean =>
    !!id && parseInt(id, 16) === spec.chainId;

  // Already on the target chain — nothing to do.
  if (isTarget(await readChain())) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (err: unknown) {
    const code = codeOf(err);
    // 4902 / 4901 = chain unknown to the wallet → add it, then switch again.
    if (code === 4902 || code === 4901) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [addChainParams(spec)],
        });
      } catch (addErr: unknown) {
        const addCode = codeOf(addErr);
        if (addCode === 4001) throw new Error("Adding the network was rejected");
        if (addCode === -32002)
          throw new Error(
            "A network request is already pending in your wallet — open it to continue",
          );
        throw new Error(`Could not add the network: ${messageOf(addErr)}`);
      }
      // Some wallets switch automatically after adding; others need a nudge.
      if (!isTarget(await readChain())) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainId }],
        });
      }
    } else if (code === 4001) {
      throw new Error("Network switch was rejected");
    } else if (code === -32002) {
      throw new Error(
        "A network request is already pending in your wallet — open it to continue",
      );
    } else {
      throw new Error(`Could not switch network: ${messageOf(err)}`);
    }
  }

  if (!isTarget(await readChain())) {
    throw new Error(
      "The wallet is still on another network — please select the GenLayer network manually",
    );
  }
}

/**
 * Connection ceremony: request accounts, then make a best-effort attempt to
 * pin the wallet to the expected chain. The connection itself never fails
 * just because the network switch was rejected or the wallet errored —
 * the caller receives the live chain id and the UI offers a manual switch.
 */
export async function connectMetaMask(spec: NetworkSpec): Promise<{
  address: string;
  chainId: string | null;
  networkSwitchError: string | null;
}> {
  const accounts = await requestAccounts();
  if (!accounts.length) throw new Error("No accounts returned by MetaMask");

  let networkSwitchError: string | null = null;
  if (!(await isOnExpectedChain(spec.chainId))) {
    try {
      await switchToNetwork(spec);
    } catch (err) {
      networkSwitchError = messageOf(err);
    }
  }

  const chainId = await getCurrentChainId();
  return { address: accounts[0], chainId, networkSwitchError };
}

/** Native token balance of an address, in wei (via the active network). */
export async function getNativeBalance(address: string): Promise<bigint> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask is not installed");
  const hex = (await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  })) as string;
  return BigInt(hex);
}

/** Short 0x1234…abcd rendering for UI. */
export function shortenAddress(address: string | null | undefined): string {
  if (!address) return "—";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** wei (bigint) → trimmed native token string. */
export function formatWeiToToken(wei: bigint, decimals = 4): string {
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  const trimmed = fracStr.slice(0, decimals).replace(/0+$/, "");
  return trimmed.length ? `${whole}.${trimmed}` : whole.toString();
}
