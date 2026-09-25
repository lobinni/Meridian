"use client";

import type { ReactNode } from "react";
import type { CaseBetTotals, CaseStatus, Verdict } from "@/lib/contracts/types";
import { poolTotal } from "@/lib/contracts/types";
import { formatGEN } from "@/lib/utils/format";
import { useAppConfig } from "@/lib/useAppConfig";

export function StatusChip({ status }: { status: CaseStatus }) {
  const cls = status === "OPEN" ? "open" : status === "DEFENSE" ? "defense" : "judged";
  const label =
    status === "OPEN" ? "Open" : status === "DEFENSE" ? "Defense" : "Judged";
  return (
    <span className={`chip ${cls}`}>
      <i />
      {label}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;
  const cls =
    verdict === "GUILTY"
      ? "v-guilty"
      : verdict === "NOT_GUILTY"
        ? "v-not-guilty"
        : "v-insufficient";
  const label =
    verdict === "GUILTY"
      ? "Guilty"
      : verdict === "NOT_GUILTY"
        ? "Not guilty"
        : "Insufficient evidence";
  return <span className={`verdict-badge ${cls}`}>{label}</span>;
}

export function PoolBar({ totals }: { totals?: CaseBetTotals }) {
  const { nativeSymbol } = useAppConfig();
  const total = poolTotal(totals);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <div className="pool">
      <div className="pool-track" role="img" aria-label="Stake distribution">
        <span className="pool-seg s-guilty" style={{ width: `${pct(totals?.guilty ?? 0)}%` }} />
        <span
          className="pool-seg s-notguilty"
          style={{ width: `${pct(totals?.not_guilty ?? 0)}%` }}
        />
        <span
          className="pool-seg s-insufficient"
          style={{ width: `${pct(totals?.insufficient_evidence ?? 0)}%` }}
        />
      </div>
      <div className="pool-legend">
        <span>
          Pool <b>{formatGEN(total)} {nativeSymbol}</b>
        </span>
        <span>
          G <b>{formatGEN(totals?.guilty ?? 0)}</b> · NG{" "}
          <b>{formatGEN(totals?.not_guilty ?? 0)}</b> · IE{" "}
          <b>{formatGEN(totals?.insufficient_evidence ?? 0)}</b>
        </span>
      </div>
    </div>
  );
}

export function SeverityMeter({ value }: { value: number }) {
  const cells: ReactNode[] = [];
  for (let i = 1; i <= 10; i++) {
    cells.push(
      <span
        key={i}
        className={`severity-cell ${i <= value ? "on" : ""} ${i <= value && value >= 7 ? "hot" : ""}`}
      />,
    );
  }
  return (
    <div className="severity" aria-label={`Severity ${value} of 10`}>
      <div className="severity-track">{cells}</div>
      <span className="severity-val">{value}/10</span>
    </div>
  );
}
