"use client";

import { useMemo } from "react";
import { History, Wallet } from "lucide-react";
import type { UserBetRecord } from "@/lib/contracts/types";
import { StatusChip, VerdictBadge } from "./ui-bits";
import { caseCode, formatGEN } from "@/lib/utils/format";
import { useUserBets } from "@/lib/hooks/useMeridianTribunal";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAppConfig } from "@/lib/useAppConfig";

interface BetHistoryProps {
  onSelectCase: (id: number) => void;
}

export default function BetHistory({ onSelectCase }: BetHistoryProps) {
  const wallet = useWallet();
  const { data: records } = useUserBets(wallet.address);

  const { active, resolved } = useMemo(() => {
    const list = (records ?? []).filter((r) => r.caseSummary);
    return {
      active: list.filter((r) => r.caseSummary?.status !== "JUDGED"),
      resolved: list.filter((r) => r.caseSummary?.status === "JUDGED"),
    };
  }, [records]);

  return (
    <section className="t-zone" aria-labelledby="histTitle" style={{ paddingTop: 24 }}>
      <div className="t-shell">
        <div className="zone-subhead">
          <div className="t-kicker on-light" style={{ margin: 0 }}>
            <History size={12} /> Your positions across the docket
          </div>
        </div>

        <h2
          id="histTitle"
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            letterSpacing: "-0.05em",
            fontSize: "clamp(30px,3.6vw,46px)",
            margin: "0 0 20px",
          }}
        >
          Stake <span style={{ color: "var(--t-accent-dark)" }}>Ledger</span>
        </h2>

        {!wallet.isConnected ? (
          <div className="list-state">
            <Wallet size={24} />
            <div className="t">Connect your wallet</div>
            <p>
              Your active stakes and settled claims will appear here once a
              wallet is linked to the network.
            </p>
          </div>
        ) : active.length === 0 && resolved.length === 0 ? (
          <div className="list-state">
            <History size={24} />
            <div className="t">No positions yet</div>
            <p>Back an outcome on any open case and it will be tracked here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {active.length > 0 ? (
              <HistoryGroup title="Awaiting verdict" rows={active} onSelectCase={onSelectCase} />
            ) : null}
            {resolved.length > 0 ? (
              <HistoryGroup title="Settled positions" rows={resolved} onSelectCase={onSelectCase} />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryGroup({
  title,
  rows,
  onSelectCase,
}: {
  title: string;
  rows: UserBetRecord[];
  onSelectCase: (id: number) => void;
}) {
  const { nativeSymbol } = useAppConfig();
  return (
    <div>
      <div className="stat-label" style={{ marginBottom: 10 }}>{title}</div>
      <div className="hist-list">
        {rows.map((r) => {
          const c = r.caseSummary;
          const judged = c?.status === "JUDGED";
          const won = judged && c?.verdict === r.bet.outcome;
          const cls = judged ? (won ? "won" : "lost") : "pending";
          return (
            <div
              key={`${r.bet.case_id}:${r.bet.bettor}`}
              className={`hist-row ${cls}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCase(r.bet.case_id)}
              onKeyDown={(e) => e.key === "Enter" && onSelectCase(r.bet.case_id)}
            >
              <span>
                <span className="t">{c?.title}</span>
                <span className="s" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  Case {caseCode(r.bet.case_id)}
                  {judged ? <VerdictBadge verdict={c?.verdict ?? ""} /> : <StatusChip status={c?.status ?? "OPEN"} />}
                </span>
              </span>
              <span className="hist-x chip" style={{ justifySelf: "start" }}>
                <i />
                {outcomeLabel(r.bet.outcome)}
              </span>
              <span className="hist-amt">
                {formatGEN(r.bet.amount)} <small>{nativeSymbol} staked</small>
              </span>
              <span style={{ textAlign: "right" }}>
                {judged ? (
                  won ? (
                    <span className="verdict-badge v-not-guilty">
                      {r.bet.claimed ? "Claimed" : "Claimable"}
                    </span>
                  ) : (
                    <span className="verdict-badge v-guilty">Settled</span>
                  )
                ) : (
                  <span className="verdict-badge v-insufficient">Live</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function outcomeLabel(outcome: string): string {
  if (outcome === "GUILTY") return "Guilty";
  if (outcome === "NOT_GUILTY") return "Not guilty";
  return "Insufficient";
}
