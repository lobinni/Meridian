"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { Case } from "@/lib/contracts/types";
import { poolTotal } from "@/lib/contracts/types";
import { StatusChip, VerdictBadge } from "./ui-bits";
import { caseCode, formatGEN } from "@/lib/utils/format";
import { useAppConfig } from "@/lib/useAppConfig";

interface LeaderboardProps {
  cases: Case[] | undefined;
  onSelectCase: (id: number) => void;
}

export default function Leaderboard({ cases, onSelectCase }: LeaderboardProps) {
  const { nativeSymbol } = useAppConfig();
  const ranked = useMemo(
    () =>
      (cases ?? [])
        .map((c) => ({ c, pool: poolTotal(c.bet_totals) }))
        .filter((e) => e.pool > 0)
        .sort((a, b) => b.pool - a.pool)
        .slice(0, 10),
    [cases],
  );

  const maxPool = ranked.length ? ranked[0].pool : 1;

  return (
    <section className="t-zone" id="leaderboard" aria-labelledby="lbTitle" style={{ paddingTop: 24 }}>
      <div className="t-shell">
        <div className="zone-subhead">
          <div className="t-kicker on-light" style={{ margin: 0 }}>
            <TrendingUp size={12} /> Market conviction · highest pooled cases
          </div>
        </div>

        <h2 id="lbTitle" style={{ fontFamily: "var(--font-syne)", fontWeight: 700, letterSpacing: "-0.05em", fontSize: "clamp(30px,3.6vw,46px)", margin: "0 0 20px" }}>
          Leader<span style={{ color: "var(--t-accent-dark)" }}>board</span>
        </h2>

        {ranked.length === 0 ? (
          <div className="list-state">
            <TrendingUp size={24} />
            <div className="t">No pools yet</div>
            <p>The first stakes placed on any case will open the rankings.</p>
          </div>
        ) : (
          <div className="lb-table">
            <div className="lb-row lb-head">
              <span>Rank</span>
              <span>Case</span>
              <span className="lb-bar-wrap">Pool share</span>
              <span style={{ textAlign: "right" }}>Total pool</span>
            </div>
            {ranked.map(({ c, pool }, i) => (
              <div
                key={c.id}
                className="lb-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelectCase(c.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelectCase(c.id)}
              >
                <span className={`lb-rank r-${i + 1}`}>
                  <span className="medal">{i + 1}</span>
                </span>
                <span className="lb-case">
                  <span className="t">{c.title}</span>
                  <span className="s" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    Case {caseCode(c.id)}
                    {c.status === "JUDGED" ? (
                      <VerdictBadge verdict={c.verdict} />
                    ) : (
                      <StatusChip status={c.status} />
                    )}
                  </span>
                </span>
                <span className="lb-bar-wrap">
                  <span className="lb-bar">
                    <i style={{ width: `${(pool / maxPool) * 100}%` }} />
                  </span>
                </span>
                <span className="lb-pool">
                  {formatGEN(pool)} <small>{nativeSymbol} pooled</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
