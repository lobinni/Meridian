"use client";

import Link from "next/link";
import { BookOpenText, Globe, Scale } from "lucide-react";
import { shortenAddress } from "@/lib/genlayer/client";
import { useAppConfig } from "@/lib/useAppConfig";

export default function Footer() {
  const {
    contractAddress,
    chainId,
    hasLiveContract,
    networkLabel,
    explorerUrl,
  } = useAppConfig();
  const explorerAddressUrl = (address: string) => `${explorerUrl}/address/${address}`;
  return (
    <>
      <div className="netstrip">
        <div className="t-shell row">
          {hasLiveContract ? (
            <a
              className="msg"
              href={explorerAddressUrl(contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <i />
              Live contract {shortenAddress(contractAddress)} · {networkLabel} · chain{" "}
              {chainId} · view on explorer
            </a>
          ) : (
            <span className="msg">
              <i />
              No contract configured · set CONTRACT_ADDRESS · {networkLabel} ·
              chain {chainId}
            </span>
          )}
          <span className="msg">Optimistic democracy · AI validators · Parimutuel pools</span>
        </div>
      </div>

      <footer className="t-footer">
        <div className="t-shell t-footer-inner">
          <Link className="t-brand" href="/" aria-label="Meridian Tribunal home">
            <span className="t-brand-mark">
              <Scale size={17} strokeWidth={1.8} />
            </span>
            <span>
              <span className="t-brand-name">Meridian</span>
              <span className="t-brand-tag">Tribunal</span>
            </span>
          </Link>

          <span className="fine">
            Decentralized dispute resolution · verdicts rendered by AI consensus
            · stakes settled on-chain
          </span>

          <div className="t-socials">
            <a
              href="https://docs.genlayer.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Documentation"
            >
              <BookOpenText size={15} />
            </a>
            <a
              href="https://studio.genlayer.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Network studio"
            >
              <Globe size={15} />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
