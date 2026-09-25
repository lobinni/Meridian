"use client";

import { Gavel, FilePlus2 } from "lucide-react";
import type { TribunalStats } from "@/lib/contracts/types";
import { formatGEN } from "@/lib/utils/format";
import { useAppConfig } from "@/lib/useAppConfig";
import { avatarAt } from "@/lib/avatars.generated";

interface HeroProps {
  stats: TribunalStats;
  onFileCase: () => void;
}

interface NodeSpec {
  className: string;
  src: string;
  alt: string;
  label?: string;
  detail?: string;
}

/** Resolve artwork for a node slot from the generated manifest. */
function pick(index: number): { src: string; alt: string } {
  const avatar = avatarAt(index);
  return { src: avatar.src, alt: avatar.label };
}

export default function Hero({ stats, onFileCase }: HeroProps) {
  const { networkLabel, chainId, nativeSymbol } = useAppConfig();
  // Artwork comes from the generated manifest (scripts/generate-avatars.mjs),
  // so the hero automatically follows whatever avatars the project ships.
  // Captions mirror live contract state — nothing is illustrative.
  const NODES: NodeSpec[] = [
    {
      className: "node-a has-info",
      ...pick(0),
      label: "Case docket",
      detail: `${stats.totalCases} filed on-chain`,
    },
    { className: "node-b", ...pick(1) },
    { className: "node-c", ...pick(2) },
    {
      className: "node-d has-info info-left",
      ...pick(3),
      label: "Pool volume",
      detail: `${formatGEN(stats.totalStaked)} ${nativeSymbol} staked`,
    },
    {
      className: "node-e has-info info-left",
      ...pick(4),
      label: "Verdicts",
      detail: `${stats.judgedCases} rendered`,
    },
    { className: "node-f", ...pick(5) },
    { className: "node-g", ...pick(6) },
    { className: "node-h", ...pick(7) },
  ];

  return (
    <section className="t-hero t-shell" aria-labelledby="heroTitle">
      <div className="hero-brackets" aria-hidden="true">
        <i className="b-tl" />
        <i className="b-tr" />
        <i className="b-bl" />
        <i className="b-br" />
      </div>

      <div className="community-network" aria-hidden="true">
        <svg
          className="community-paths"
          viewBox="0 0 1200 680"
          preserveAspectRatio="none"
        >
          <path d="M76 92 C205 150 128 262 226 324 S104 523 204 607" />
          <path d="M1124 108 C1005 164 1088 260 984 334 S1106 502 1002 596" />
        </svg>
        {NODES.map((node) => (
          <div key={node.className} className={`community-node ${node.className}`}>
            {/* Inline SVG artwork — no optimizer or remote host involved. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.src}
              alt={node.alt}
              width={70}
              height={70}
              decoding="async"
            />
            {node.label ? (
              <span className="community-info">
                <strong>{node.label}</strong>
                <small>{node.detail}</small>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hero-copy">
        <div className="t-kicker">
          {networkLabel} · Chain {chainId}
        </div>
        <h1 id="heroTitle">
          On-Chain Disputes,
          <br />
          <span>Judged by AI.</span>
        </h1>
        <p>File. Defend. Stake. Verdict.</p>
        <div className="hero-ctas">
          <button type="button" className="btn btn-accent" onClick={onFileCase}>
            <FilePlus2 size={14} /> File a case
          </button>
          <a className="btn btn-ghost-dark" href="#docket">
            <Gavel size={14} /> Explore docket
          </a>
        </div>
        <div className="hero-proof" aria-label="Protocol status">
          <span>
            <i /> {stats.totalCases} cases filed
          </span>
          <span>
            <i /> {formatGEN(stats.totalStaked)} {nativeSymbol} staked
          </span>
          <span>
            <i /> {stats.judgedCases} verdicts rendered
          </span>
        </div>
      </div>

      <div className="hero-corner-meta" aria-hidden="true">
        <span>Optimistic consensus</span>
        <span>Parimutuel market</span>
        <span>Live protocol</span>
      </div>
    </section>
  );
}
