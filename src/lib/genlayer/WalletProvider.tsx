"use client";

/**
 * WalletProvider — single source of truth for MetaMask state.
 *
 * Shares the connected address / chain across the whole app, keeps the
 * user pinned to the expected GenLayer chain, listens to account and chain
 * changes, and remembers explicit disconnects. The expected chain comes
 * from the AppConfig context (server-resolved env).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectMetaMask,
  getAccounts,
  getCurrentChainId,
  getEthereumProvider,
  isMetaMaskInstalled,
  networkSpecOf,
  requestAccounts,
  switchToNetwork,
  type NetworkSpec,
} from "./client";
import { useAppConfig } from "@/lib/useAppConfig";

const DISCONNECT_FLAG = "meridian_wallet_disconnected";

export interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isMetaMaskInstalled: boolean;
  isOnCorrectNetwork: boolean;
}

interface WalletContextValue extends WalletState {
  networkSpec: NetworkSpec;
  connectWallet: () => Promise<string>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string>;
  ensureCorrectNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const config = useAppConfig();
  const networkSpec = useMemo(() => networkSpecOf(config), [config]);

  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isLoading: true,
    isMetaMaskInstalled: false,
    isOnCorrectNetwork: false,
  });

  const correctNetwork = useCallback(
    (chainId: string | null) => {
      if (!chainId) return false;
      return parseInt(chainId, 16) === networkSpec.chainId;
    },
    [networkSpec.chainId],
  );

  // Initial load: detect MetaMask and silently restore a permitted session.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const installed = isMetaMaskInstalled();
      if (!installed) {
        if (!cancelled) {
          setState({
            address: null,
            chainId: null,
            isConnected: false,
            isLoading: false,
            isMetaMaskInstalled: false,
            isOnCorrectNetwork: false,
          });
        }
        return;
      }

      const wasDisconnected =
        typeof window !== "undefined" &&
        localStorage.getItem(DISCONNECT_FLAG) === "true";

      if (wasDisconnected) {
        if (!cancelled) {
          setState({
            address: null,
            chainId: null,
            isConnected: false,
            isLoading: false,
            isMetaMaskInstalled: true,
            isOnCorrectNetwork: false,
          });
        }
        return;
      }

      try {
        const accounts = await getAccounts();
        const chainId = await getCurrentChainId();
        if (!cancelled) {
          setState({
            address: accounts[0] ?? null,
            chainId,
            isConnected: accounts.length > 0,
            isLoading: false,
            isMetaMaskInstalled: true,
            isOnCorrectNetwork: correctNetwork(chainId),
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            address: null,
            chainId: null,
            isConnected: false,
            isLoading: false,
            isMetaMaskInstalled: true,
            isOnCorrectNetwork: false,
          });
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [correctNetwork]);

  // Provider event listeners (accounts / chain).
  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? [];
      const chainId = await getCurrentChainId();
      if (accounts.length > 0 && typeof window !== "undefined") {
        localStorage.removeItem(DISCONNECT_FLAG);
      }
      setState((prev) => ({
        ...prev,
        address: accounts[0] ?? null,
        chainId,
        isConnected: accounts.length > 0,
        isOnCorrectNetwork: correctNetwork(chainId),
      }));
    };

    const handleChainChanged = async (...args: unknown[]) => {
      const chainId = (args[0] as string) ?? null;
      setState((prev) => ({
        ...prev,
        chainId,
        isOnCorrectNetwork: correctNetwork(chainId),
      }));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  }, [correctNetwork]);

  const connectWallet = useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const { address, chainId, networkSwitchError } =
        await connectMetaMask(networkSpec);
      if (typeof window !== "undefined") {
        localStorage.removeItem(DISCONNECT_FLAG);
      }
      setState({
        address,
        chainId,
        isConnected: true,
        isLoading: false,
        isMetaMaskInstalled: true,
        isOnCorrectNetwork: correctNetwork(chainId),
      });
      // The account is connected even if the wallet stayed on another
      // chain — surface that as a soft warning so the caller can toast it.
      if (networkSwitchError) {
        console.warn(`Connected but not on the GenLayer network: ${networkSwitchError}`);
      }
      return address;
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [correctNetwork, networkSpec]);

  const disconnectWallet = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISCONNECT_FLAG, "true");
    }
    setState((prev) => ({
      ...prev,
      address: null,
      isConnected: false,
    }));
  }, []);

  const switchWalletAccount = useCallback(async (): Promise<string> => {
    const accounts = await requestAccounts();
    if (!accounts.length) throw new Error("No account selected");
    const chainId = await getCurrentChainId();
    setState((prev) => ({
      ...prev,
      address: accounts[0],
      chainId,
      isConnected: true,
      isOnCorrectNetwork: correctNetwork(chainId),
    }));
    return accounts[0];
  }, [correctNetwork]);

  const ensureCorrectNetwork = useCallback(async (): Promise<void> => {
    await switchToNetwork(networkSpec);
    const chainId = await getCurrentChainId();
    setState((prev) => ({
      ...prev,
      chainId,
      isOnCorrectNetwork: correctNetwork(chainId),
    }));
  }, [correctNetwork, networkSpec]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        networkSpec,
        connectWallet,
        disconnectWallet,
        switchWalletAccount,
        ensureCorrectNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
