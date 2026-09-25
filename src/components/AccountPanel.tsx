"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Copy,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Repeat,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { shortenAddress, isOnExpectedChain } from "@/lib/genlayer/client";
import { useAppConfig } from "@/lib/useAppConfig";
import { errorMessage, addressHue, avatarInitials } from "@/lib/utils/format";

export default function AccountPanel() {
  const wallet = useWallet();
  const { networkLabel, chainId, hasLiveContract } = useAppConfig();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleConnect = async () => {
    try {
      await wallet.connectWallet();
      // Re-read the live chain — connecting is best-effort about switching.
      if (await isOnExpectedChain(chainId)) {
        toast.success("Wallet connected", {
          description: `Pinned to ${networkLabel} · chain ${chainId}`,
        });
      } else {
        toast.warning("Wallet connected — wrong network", {
          description: `Open the account menu and switch to ${networkLabel} (chain ${chainId}) to participate.`,
        });
      }
    } catch (err) {
      toast.error("Connection failed", { description: errorMessage(err) });
    }
  };

  const busy = wallet.isLoading;
  const connected = wallet.isConnected && wallet.address;
  const onNet = wallet.isOnCorrectNetwork;

  /* ------------------------------ loading ------------------------------ */
  if (busy && !connected) {
    return (
      <div className="t-account-wrap">
        <button className="t-account" type="button" disabled>
          <span className="avatar is-off">
            <LoaderCircle size={15} className="animate-spin" />
          </span>
          <span className="meta">
            <strong>Restoring…</strong>
            <small>{networkLabel}</small>
          </span>
        </button>
      </div>
    );
  }

  /* ---------------------------- disconnected --------------------------- */
  if (!connected) {
    return (
      <div className="t-account-wrap" ref={wrapRef}>
        <button
          className="t-account"
          type="button"
          onClick={handleConnect}
          aria-haspopup="dialog"
        >
          <span className="avatar is-off">
            <Wallet size={15} />
          </span>
          <span className="meta">
            <strong>Connect MetaMask</strong>
            <small>
              {networkLabel} · {chainId}
            </small>
          </span>
        </button>
      </div>
    );
  }

  /* ----------------------------- connected ----------------------------- */
  const hue = addressHue(wallet.address as string);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address as string);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const switchNetwork = async () => {
    try {
      await wallet.ensureCorrectNetwork();
      toast.success(`Switched to ${networkLabel}`);
      setOpen(false);
    } catch (err) {
      toast.error("Switch failed", { description: errorMessage(err) });
    }
  };

  const switchAccount = async () => {
    try {
      await wallet.switchWalletAccount();
      setOpen(false);
    } catch (err) {
      toast.error("Account switch failed", { description: errorMessage(err) });
    }
  };

  return (
    <div className="t-account-wrap" ref={wrapRef}>
      <button
        className="t-account"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className="avatar"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 60% 82%), #35d5b4)`,
          }}
        >
          {avatarInitials(wallet.address as string)}
        </span>
        <span className="meta">
          <strong>{shortenAddress(wallet.address)}</strong>
          <small className={onNet ? "" : "off-net"}>
            {onNet ? `${networkLabel} · live` : "Wrong network"}
          </small>
        </span>
        <ChevronDown
          size={14}
          style={{
            transition: "transform .18s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 280,
            background: "var(--t-paper)",
            border: "1px solid var(--t-line)",
            boxShadow: "0 24px 60px rgba(7,17,14,.18)",
            zIndex: 60,
            animation: "fade-in .15s ease",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid var(--t-line-soft)" }}>
            <div className="stat-label">Connected account</div>
            <div
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 12,
                marginTop: 8,
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
            >
              {wallet.address}
            </div>
            {!onNet ? (
              <button
                type="button"
                onClick={switchNetwork}
                style={{
                  marginTop: 12,
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 40,
                  border: "1px solid var(--t-warn)",
                  background: "rgba(240,167,75,.12)",
                  color: "#936800",
                  font: "500 10px/1 var(--font-dm-mono), monospace",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                <ShieldAlert size={13} /> Switch to {networkLabel}
              </button>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  font: "500 9px/1 var(--font-dm-mono), monospace",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--t-accent-dark)",
                }}
              >
                {hasLiveContract ? "On-chain protocol" : "No contract configured"} · {networkLabel}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { icon: <Copy size={14} />, label: "Copy address", action: copyAddress },
              { icon: <Repeat size={14} />, label: "Switch account", action: switchAccount },
              {
                icon: <RefreshCcw size={14} />,
                label: `Switch network`,
                action: switchNetwork,
              },
              {
                icon: <LogOut size={14} />,
                label: "Disconnect",
                action: () => {
                  wallet.disconnectWallet();
                  setOpen(false);
                  toast("Disconnected");
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  border: 0,
                  borderBottom: "1px solid var(--t-line-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  font: "500 10px/1 var(--font-dm-mono), monospace",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--t-ink)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--t-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
