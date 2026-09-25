"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Droplets,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatWeiToToken, getNativeBalance } from "@/lib/genlayer/client";
import { FAUCET_LINKS } from "@/lib/config";
import { useAppConfig } from "@/lib/useAppConfig";

export default function FaucetPage() {
  const wallet = useWallet();
  const { networkLabel, chainId, nativeSymbol } = useAppConfig();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet.address) return;
    setLoading(true);
    try {
      const wei = await getNativeBalance(wallet.address);
      setBalance(formatWeiToToken(wei));
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <main>
      <Navbar />

      <section className="t-shell" style={{ marginTop: 22 }}>
        <div className="faucet-panel">
          <div className="t-kicker">
            <Droplets size={12} /> {networkLabel} treasury · chain {chainId}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-syne)",
              fontWeight: 700,
              letterSpacing: "-0.05em",
              fontSize: "clamp(40px,5vw,64px)",
              lineHeight: 1,
              margin: "0 0 10px",
              position: "relative",
            }}
          >
            Fuel your <span style={{ color: "var(--t-accent)" }}>stakes.</span>
          </h1>
          <p
            style={{
              color: "#f8fcf98f",
              font: "400 11px/1.8 var(--font-dm-mono), monospace",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              maxWidth: 520,
              position: "relative",
            }}
          >
            Test {nativeSymbol} powers filings, stakes and claims. Top up from an
            official tap, then return to the docket.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 34,
              flexWrap: "wrap",
              position: "relative",
            }}
          >
            <div>
              <div className="stat-label" style={{ color: "#f8fcf966" }}>
                Connected balance
              </div>
              <div className="faucet-balance" aria-live="polite">
                {wallet.isConnected
                  ? loading && balance === null
                    ? "……"
                    : balance ?? "……"
                  : "—"}
                <span style={{ fontSize: "0.35em", marginLeft: 10, letterSpacing: 0 }}>
                  {nativeSymbol}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={refresh}
              disabled={!wallet.isConnected || loading}
              style={{ position: "relative" }}
            >
              {loading ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <RefreshCcw size={14} />
              )}
              Refresh
            </button>
          </div>

          {!wallet.isConnected ? (
            <p
              style={{
                marginTop: 22,
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                font: "500 10px/1.6 var(--font-dm-mono), monospace",
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "#f0a74b",
                border: "1px solid #f0a74b55",
                padding: "10px 14px",
              }}
            >
              <Wallet size={13} /> Connect MetaMask on {networkLabel} to see your
              balance live.
            </p>
          ) : null}
        </div>
      </section>

      <section className="t-shell" style={{ marginTop: 40 }}>
        <div className="zone-subhead" style={{ marginTop: 0 }}>
          <div className="t-kicker on-light" style={{ margin: 0 }}>
            Official taps & references
          </div>
        </div>

        <div className="faucet-link-row">
          {FAUCET_LINKS.map((link) => (
            <a key={link.title} className="faucet-link" href={link.url} target="_blank" rel="noopener noreferrer">
              <span className="t">
                <Droplets size={15} style={{ color: "var(--t-accent-dark)" }} />
                {link.title}
              </span>
              <span className="s">{link.note}</span>
              <span
                className="s"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--t-accent-dark)" }}
              >
                Open <ExternalLink size={10} />
              </span>
            </a>
          ))}
        </div>

        <div style={{ margin: "34px 0 10px" }}>
          <Link href="/" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to the docket
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
