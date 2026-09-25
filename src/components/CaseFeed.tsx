"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, FilePlus2, Inbox, LoaderCircle } from "lucide-react";
import type { Case, TribunalStats } from "@/lib/contracts/types";
import { poolTotal } from "@/lib/contracts/types";
import { StatusChip, VerdictBadge, PoolBar, SeverityMeter } from "./ui-bits";
import { caseCode, formatGEN } from "@/lib/utils/format";
import { shortenAddress } from "@/lib/genlayer/client";
import { useCases } from "@/lib/hooks/useMeridianTribunal";
import { useAppConfig } from "@/lib/useAppConfig";

type Filter = "ALL" | "OPEN" | "DEFENSE" | "JUDGED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "DEFENSE", label: "Defense" },
  { key: "JUDGED", label: "Judged" },
];

interface CaseFeedProps {
  stats: TribunalStats;
  onSelectCase: (id: number) => void;
  onFileCase: () => void;
}

export default function CaseFeed({ stats, onSelectCase, onFileCase }: CaseFeedProps) {
  const { nativeSymbol, hasLiveContract } = useAppConfig();
  const { data: cases, isLoading, isError } = useCases();
  const [filter, setFilter] = useState<Filter>("ALL");

  const filtered = useMemo(() => {
    const list = [...(cases ?? [])].sort((a, b) => b.id - a.id);
    if (filter === "ALL") return list;
    return list.filter((c) => c.status === filter);
  }, [cases, filter]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { ALL: cases?.length ?? 0, OPEN: 0, DEFENSE: 0, JUDGED: 0 };
    for (const c of cases ?? []) base[c.status] += 1;
    return base;
  }, [cases]);

  return (
    <section className="t-zone" id="docket" aria-labelledby="docketTitle">
      <div className="t-shell">
        <div className="zone-head">
          <div>
            <div className="t-kicker on-light">
              Docket control · {stats.totalCases} cases filed
            </div>
            <h2 id="docketTitle">
              Case <span>Docket</span>
            </h2>
            <p>
              Every dispute is argued in the open and resolved by independent AI
              validators. Stake {nativeSymbol} on the outcome you believe in —
              winners split the entire pool.
            </p>
          </div>
          <button type="button" className="btn" onClick={onFileCase}>
            <FilePlus2 size={14} /> File a case
          </button>
        </div>

        <div className="stat-grid reveal" style={{ ["--reveal-delay" as never]: "0s" }}>
          <div className="stat-tile">
            <div className="stat-label">Cases filed</div>
            <div className="stat-value">{stats.totalCases}</div>
            <div className="stat-sub">Lifetime disputes</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Awaiting defense</div>
            <div className="stat-value">{stats.openCases}</div>
            <div className="stat-sub">{stats.defenseCases} in defense stage</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Verdicts rendered</div>
            <div className="stat-value">
              <em>{stats.judgedCases}</em>
            </div>
            <div className="stat-sub">
              {stats.verdicts.guilty} guilty · {stats.verdicts.notGuilty} cleared ·{" "}
              {stats.verdicts.insufficient} unproven
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">{nativeSymbol} in pools</div>
            <div className="stat-value">{formatGEN(stats.totalStaked)}</div>
            <div className="stat-sub">
              {hasLiveContract ? "Escrowed on-chain" : "Contract not configured"}
            </div>
          </div>
        </div>

        <div className="task-controls" style={{ marginTop: 22 }} aria-label="Case filters">
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`filter-button ${filter === f.key ? "is-active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          {isLoading ? (
            <div className="list-state">
              <LoaderCircle size={26} className="animate-spin" style={{ color: "var(--t-accent-dark)" }} />
              <div className="t">Summoning the docket…</div>
              <p>Case records are being retrieved from the tribunal ledger.</p>
            </div>
          ) : isError ? (
            <div className="list-state">
              <Inbox size={26} />
              <div className="t">The docket could not be reached</div>
              <p>Check the network configuration and try again in a moment.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-state">
              <Inbox size={26} />
              <div className="t">
                {hasLiveContract
                  ? "The on-chain docket is empty"
                  : "No contract configured"}
              </div>
              <p>
                {hasLiveContract
                  ? "File the first dispute and let the tribunal render its verdict. Every case shown here is read directly from the deployed contract."
                  : "Set a contract address in the configuration and restart — the docket reads exclusively from the deployed contract."}
              </p>
            </div>
          ) : (
            <div className="case-grid">
              {filtered.map((c, i) => (
                <CaseCard
                  key={c.id}
                  caseData={c}
                  index={i}
                  onOpen={() => onSelectCase(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CaseCard({
  caseData: c,
  index,
  onOpen,
}: {
  caseData: Case;
  index: number;
  onOpen: () => void;
}) {
  const { nativeSymbol } = useAppConfig();
  return (
    <article
      className="t-card cornered case-card reveal"
      style={{ ["--reveal-delay" as never]: `${Math.min(index, 6) * 60}ms` }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open case ${caseCode(c.id)}`}
    >
      <div className="case-card-head">
        <span className="case-id">Case {caseCode(c.id)}</span>
        <StatusChip status={c.status} />
      </div>

      <div className="case-card-body">
        <h3 className="case-title">{c.title}</h3>
        <div className="case-parties">
          <span>
            Plaintiff <b>{shortenAddress(c.plaintiff)}</b>
          </span>
          <span>
            Defendant <b>{shortenAddress(c.defendant)}</b>
          </span>
        </div>
        <PoolBar totals={c.bet_totals} />
      </div>

      <div className="case-card-foot">
        {c.status === "JUDGED" ? (
          <>
            <VerdictBadge verdict={c.verdict} />
            <SeverityMeter value={c.severity} />
          </>
        ) : (
          <>
            <span className="case-parties" style={{ textTransform: "uppercase" }}>
              {formatGEN(poolTotal(c.bet_totals))} {nativeSymbol} staked
            </span>
            <span className="case-open-cta">
              Review <ArrowUpRight size={12} />
            </span>
          </>
        )}
      </div>
    </article>
  );
}
