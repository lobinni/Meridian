"use client";

/**
 * useRequireWallet — returns an async resolver that guarantees a wallet
 * is connected AND pinned to the expected GenLayer chain before any
 * on-chain action runs. Rejections surface as toasts by the caller.
 */

import { useCallback } from "react";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { isOnExpectedChain } from "@/lib/genlayer/client";

export function useRequireWallet() {
  const wallet = useWallet();

  return useCallback(async (): Promise<string> => {
    if (!wallet.isMetaMaskInstalled) {
      throw new Error("MetaMask is required to participate — install it to continue");
    }

    let address = wallet.address;
    if (!address || !wallet.isConnected) {
      address = await wallet.connectWallet();
    }

    // Check the LIVE chain (state can be stale right after a connect),
    // and only force a switch when the wallet really is elsewhere.
    if (!(await isOnExpectedChain(wallet.networkSpec.chainId))) {
      await wallet.ensureCorrectNetwork();
    }
    return address;
  }, [wallet]);
}
