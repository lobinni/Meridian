"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale } from "lucide-react";
import AccountPanel from "./AccountPanel";
import { useAppConfig } from "@/lib/useAppConfig";

const LINKS = [
  { href: "/", label: "Docket" },
  { href: "/faucet", label: "Faucet" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { networkLabel, chainId } = useAppConfig();

  return (
    <header className="t-header">
      <div className="t-shell">
        <nav className="t-nav" aria-label="Protocol navigation">
          <Link className="t-brand" href="/" aria-label="Meridian Tribunal home">
            <span className="t-brand-mark">
              <Scale size={17} strokeWidth={1.8} />
            </span>
            <span>
              <span className="t-brand-name">Meridian</span>
              <span className="t-brand-tag">Tribunal</span>
            </span>
          </Link>

          <div className="t-nav-links">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "active" : ""}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <a href="/#leaderboard">Leaderboard</a>
          </div>

          <AccountPanel />
        </nav>
        <div
          aria-hidden="true"
          style={{
            marginTop: 8,
            textAlign: "right",
            font: "500 8px/1 var(--font-dm-mono), monospace",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--t-faint)",
          }}
        >
          {networkLabel} · chain {chainId}
        </div>
      </div>
    </header>
  );
}
