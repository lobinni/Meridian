"use client";

import { useMemo, useState } from "react";
import { Coins, Gavel, LoaderCircle, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Bet, Case, Outcome } from "@/lib/contracts/types";
import { OUTCOMES, poolTotal } from "@/lib/contracts/types";
import {
  useClaimWinnings,
  usePlaceBet,
} from "@/lib/hooks/useMeridianTribunal";
import { useRequireWallet } from "@/lib/hooks/useRequireWallet";
import { errorMessage, formatGEN } from "@/lib/utils/format";
import { useAppConfig } from "@/lib/useAppConfig";

const QUICK_STAKES = [5, 10, 25, 50];

const OUTCOME_STYLE: Record<Outcome, { cls: string; name: string }> = {
  GUILTY: { cls: "o-guilty", name: "Guilty" },
  NOT_GUILTY: { cls: "o-notguilty", name: "Not guilty" },
  INSUFFICIENT_EVIDENCE: { cls: "o-insufficient", name: "Insufficient" },
};

interface BettingPanelProps {
  caseData: Case;
  userBet: Bet | undefined;
  address: string | null;
}

export default function BettingPanel({ caseData, userBet, address }: BettingPanelProps) {
  const { nativeSymbol } = useAppConfig();
  const requireWallet = useRequireWallet();
  const placeBet = usePlaceBet();
  const claim = useClaimWinnings();

  const [outcome, setOutcome] = useState<Outcome>("NOT_GUILTY");
  const [amount, setAmount] = useState<string>("10");

  const totals = caseData.bet_totals;
  const pool = poolTotal(totals);
  const judged = caseData.status === "JUDGED";
  const isParty =
    !!address &&
    (caseData.plaintiff.toLowerCase() === address.toLowerCase() ||
      caseData.defendant.toLowerCase() === address.toLowerCase());

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const projectedShare = useMemo(() => {
    if (!amountValid || !totals) return null;
    const bucket =
      outcome === "GUILTY"
        ? totals.guilty
        : outcome === "NOT_GUILTY"
          ? totals.not_guilty
          : totals.insufficient_evidence;
    return (parsedAmount / (bucket + parsedAmount)) * 100;
  }, [amountValid, parsedAmount, outcome, totals]);

  const potentialReturn = useMemo(() => {
    if (!amountValid || !totals || projectedShare === null) return null;
    const futurePool = pool + parsedAmount;
    return (projectedShare / 100) * futurePool;
  }, [amountValid, totals, pool, parsedAmount, projectedShare]);

  const handlePlaceBet = async () => {
    try {
      const sender = await requireWallet();
      if (!amountValid) {
        toast.error("Enter a valid stake amount");
        return;
      }
      toast.loading("Confirm the stake in MetaMask…", { id: "bet" });
      await placeBet.mutateAsync({ sender, caseId: caseData.id, outcome, amount: parsedAmount });
      toast.success("Stake placed", {
        id: "bet",
        description: `${formatGEN(parsedAmount)} ${nativeSymbol} on ${OUTCOME_STYLE[outcome].name}`,
      });
    } catch (err) {
      toast.error("Stake failed", { id: "bet", description: errorMessage(err) });
    }
  };

  const handleClaim = async () => {
    try {
      const sender = await requireWallet();
      toast.loading("Settling claim…", { id: "claim" });
      const winnings = await claim.mutateAsync({ sender, caseId: caseData.id });
      toast.success(
        winnings > 0 ? `Claimed ${formatGEN(winnings)} ${nativeSymbol}` : "Claim settled",
        { id: "claim" },
      );
    } catch (err) {
      toast.error("Claim failed", { id: "claim", description: errorMessage(err) });
    }
  };

  /* -------- judged + user holds a bet: position & claim settlement -------- */
  if (judged) {
    const won = userBet?.exists && userBet.outcome === caseData.verdict;
    return (
      <div className="t-card" style={{ padding: 20 }}>
        <div className="t-kicker on-light" style={{ marginBottom: 14 }}>
          Verdict market · settled
        </div>
        <OutcomeShares totals={totals} pool={pool} />
        {userBet?.exists ? (
          <div
            style={{
              marginTop: 16,
              border: "1px solid var(--t-line)",
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              background: won ? "var(--t-accent-soft)" : "var(--t-bg)",
            }}
          >
            <div>
              <div className="stat-label">Your position</div>
              <div style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: 20, marginTop: 6 }}>
                {formatGEN(userBet.amount)} {nativeSymbol}
                <span style={{ fontSize: 12, fontWeight: 600, color: won ? "var(--t-accent-dark)" : "var(--t-danger)", marginLeft: 10 }}>
                  {won ? "Backed the verdict" : "Backed the losing side"}
                </span>
              </div>
            </div>
            {won && !userBet.claimed ? (
              <button type="button" className="btn btn-accent" onClick={handleClaim} disabled={claim.isPending}>
                {claim.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Trophy size={14} />}
                Claim winnings
              </button>
            ) : (
              <span className="chip">
                <i /> {userBet.claimed ? "Settled" : "No payout available"}
              </span>
            )}
          </div>
        ) : (
          <p style={{ font: "400 11px/1.7 var(--font-dm-mono), monospace", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--t-faint)", margin: "16px 0 0" }}>
            This market is settled — stakes on the verdict were distributed to winners.
          </p>
        )}
      </div>
    );
  }

  /* ------------------------------ open market ----------------------------- */
  return (
    <div className="t-card" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="t-kicker on-light" style={{ margin: 0 }}>
          Verdict market · {formatGEN(pool)} {nativeSymbol} pooled
        </div>
        {userBet?.exists ? (
          <span className="chip defense">
            <i />
            Your stake: {formatGEN(userBet.amount)} {nativeSymbol} on{" "}
            {OUTCOME_STYLE[userBet.outcome as Outcome]?.name ?? userBet.outcome}
          </span>
        ) : null}
      </div>

      <div className="outcome-grid">
        {OUTCOMES.map((o) => {
          const bucket =
            o === "GUILTY"
              ? totals?.guilty ?? 0
              : o === "NOT_GUILTY"
                ? totals?.not_guilty ?? 0
                : totals?.insufficient_evidence ?? 0;
          const share = pool > 0 ? (bucket / pool) * 100 : 0;
          return (
            <button
              key={o}
              type="button"
              className={`outcome-card ${OUTCOME_STYLE[o].cls} ${outcome === o ? "selected" : ""}`}
              onClick={() => setOutcome(o)}
              disabled={userBet?.exists && userBet.outcome !== o}
            >
              <span className="outcome-name">
                <i /> {OUTCOME_STYLE[o].name}
              </span>
              <span className="outcome-share">{share.toFixed(0)}%</span>
              <span className="outcome-pool">
                {formatGEN(bucket)} {nativeSymbol} staked
              </span>
            </button>
          );
        })}
      </div>

      {isParty ? (
        <p style={{ font: "500 10px/1.7 var(--font-dm-mono), monospace", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--t-warn)", margin: "16px 0 0" }}>
          Parties to this dispute cannot stake on the outcome.
        </p>
      ) : (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="stake-amount">
              Stake amount ({nativeSymbol})
            </label>
            <input
              id="stake-amount"
              type="number"
              min="0"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount in ${nativeSymbol}`}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {QUICK_STAKES.map((q) => (
              <button
                key={q}
                type="button"
                className="filter-button"
                style={{ border: "1px solid var(--t-line)", minHeight: 36 }}
                onClick={() => setAmount(String(q))}
              >
                {q} {nativeSymbol}
              </button>
            ))}
          </div>

          {projectedShare !== null && potentialReturn !== null ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                font: "400 10px/1.6 var(--font-dm-mono), monospace",
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: "var(--t-muted)",
                borderTop: "1px dashed var(--t-line-soft)",
                paddingTop: 12,
              }}
            >
              <span>Pool share if correct: {projectedShare.toFixed(1)}%</span>
              <span>
                Est. return: <b style={{ color: "var(--t-accent-dark)" }}>{formatGEN(potentialReturn)} {nativeSymbol}</b>
              </span>
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-accent"
            onClick={handlePlaceBet}
            disabled={placeBet.isPending || !amountValid}
            style={{ minHeight: 50 }}
          >
            {placeBet.isPending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Coins size={15} />
            )}
            {userBet?.exists ? "Add to position" : "Place stake"}
          </button>

          <p style={{ font: "400 9px/1.7 var(--font-dm-mono), monospace", letterSpacing: ".04em", textTransform: "uppercase", color: "var(--t-faint)", margin: 0 }}>
            <Gavel size={10} style={{ verticalAlign: -1 }} /> Stakes are locked until the
            verdict renders. Winners split the entire pool proportionally.
          </p>
        </div>
      )}
    </div>
  );
}

function OutcomeShares({ totals, pool }: { totals: Case["bet_totals"]; pool: number }) {
  const { nativeSymbol } = useAppConfig();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
      }}
    >
      {OUTCOMES.map((o) => {
        const bucket =
          o === "GUILTY"
            ? totals?.guilty ?? 0
            : o === "NOT_GUILTY"
              ? totals?.not_guilty ?? 0
              : totals?.insufficient_evidence ?? 0;
        const share = pool > 0 ? (bucket / pool) * 100 : 0;
        return (
          <div key={o} style={{ border: "1px solid var(--t-line-soft)", padding: 14 }}>
            <span className={`outcome-name ${OUTCOME_STYLE[o].cls}`}>
              <i
                style={{
                  background:
                    o === "GUILTY"
                      ? "var(--t-danger)"
                      : o === "NOT_GUILTY"
                        ? "var(--t-accent)"
                        : "var(--t-warn)",
                }}
              />{" "}
              {OUTCOME_STYLE[o].name}
            </span>
            <div style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: 20, marginTop: 8 }}>
              {share.toFixed(0)}%
            </div>
            <div className="outcome-pool">{formatGEN(bucket)} {nativeSymbol}</div>
          </div>
        );
      })}
    </div>
  );
}
