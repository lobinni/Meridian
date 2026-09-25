/**
 * TypeScript shapes mirroring the Meridian Tribunal contract views.
 */

export type CaseStatus = "OPEN" | "DEFENSE" | "JUDGED";

export type Verdict = "" | "GUILTY" | "NOT_GUILTY" | "INSUFFICIENT_EVIDENCE";

export interface CaseBetTotals {
  guilty: number;
  not_guilty: number;
  insufficient_evidence: number;
}

export interface Case {
  id: number;
  plaintiff: string;
  defendant: string;
  title: string;
  description: string;
  evidence_urls: string;
  defense_text: string;
  defense_urls: string;
  verdict: Verdict;
  reasoning: string;
  severity: number;
  status: CaseStatus;
  escrow?: number;
  bet_totals?: CaseBetTotals;
}

export interface CaseSummary {
  id: number;
  plaintiff: string;
  defendant: string;
  title: string;
  verdict: Verdict;
  severity: number;
  status: CaseStatus;
  bet_totals?: CaseBetTotals;
}

export interface Bet {
  exists: boolean;
  bettor: string;
  case_id: number;
  outcome: string;
  amount: number;
  claimed: boolean;
}

export interface TribunalStats {
  totalCases: number;
  openCases: number;
  defenseCases: number;
  judgedCases: number;
  verdicts: {
    guilty: number;
    notGuilty: number;
    insufficient: number;
  };
  totalStaked: number;
}

export interface UserBetRecord {
  bet: Bet;
  caseSummary: CaseSummary | null;
}

export const OUTCOMES = ["GUILTY", "NOT_GUILTY", "INSUFFICIENT_EVIDENCE"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  GUILTY: "Guilty",
  NOT_GUILTY: "Not Guilty",
  INSUFFICIENT_EVIDENCE: "Insufficient",
};

/** Total GEN pooled on a case across all three outcomes. */
export function poolTotal(totals?: CaseBetTotals): number {
  if (!totals) return 0;
  return totals.guilty + totals.not_guilty + totals.insufficient_evidence;
}
