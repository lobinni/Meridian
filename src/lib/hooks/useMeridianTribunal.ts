"use client";

/**
 * TanStack Query hooks wrapping the tribunal contract bridge.
 * Queries poll on a gentle cadence so verdicts, pools and claims stay
 * live without user interaction.
 *
 * The bridge instance comes from the AppConfig context (created per
 * server-resolved configuration), so these hooks automatically follow
 * whatever contract address the deployment is pointed at.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTribunal } from "@/lib/useAppConfig";
import type {
  Bet,
  Case,
  Outcome,
  TribunalStats,
  UserBetRecord,
} from "@/lib/contracts/types";
import { poolTotal } from "@/lib/contracts/types";
import {
  DETAIL_REFETCH_INTERVAL,
  FEED_REFETCH_INTERVAL,
} from "@/lib/config";

const KEYS = {
  cases: ["tribunal", "cases"] as const,
  case: (id: number) => ["tribunal", "case", id] as const,
  bet: (id: number, addr: string | null) => ["tribunal", "bet", id, addr] as const,
  userBets: (addr: string | null) => ["tribunal", "userBets", addr] as const,
};

export function useCases() {
  const tribunal = useTribunal();
  return useQuery<Case[]>({
    queryKey: KEYS.cases,
    queryFn: () => tribunal.getAllCases(),
    refetchInterval: FEED_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });
}

export function useCase(caseId: number | null) {
  const tribunal = useTribunal();
  return useQuery<Case>({
    queryKey: KEYS.case(caseId ?? -1),
    queryFn: () => tribunal.getCase(caseId as number),
    enabled: caseId !== null,
    refetchInterval: DETAIL_REFETCH_INTERVAL,
  });
}

export function useCaseBet(caseId: number | null, address: string | null) {
  const tribunal = useTribunal();
  return useQuery<Bet>({
    queryKey: KEYS.bet(caseId ?? -1, address),
    queryFn: () => tribunal.getBet(caseId as number, address),
    enabled: caseId !== null && Boolean(address),
    refetchInterval: FEED_REFETCH_INTERVAL,
  });
}

export function useUserBets(address: string | null) {
  const tribunal = useTribunal();
  return useQuery<UserBetRecord[]>({
    queryKey: KEYS.userBets(address),
    enabled: Boolean(address),
    queryFn: async () => {
      const bets = await tribunal.getAllBetsFor(address as string);
      const cases = await tribunal.getAllCases();
      return bets.map((bet) => ({
        bet,
        caseSummary: cases.find((c) => c.id === bet.case_id) ?? null,
      }));
    },
    refetchInterval: DETAIL_REFETCH_INTERVAL,
    placeholderData: [],
  });
}

export function useStats(cases: Case[] | undefined): TribunalStats {
  const stats: TribunalStats = {
    totalCases: cases?.length ?? 0,
    openCases: 0,
    defenseCases: 0,
    judgedCases: 0,
    verdicts: { guilty: 0, notGuilty: 0, insufficient: 0 },
    totalStaked: 0,
  };
  for (const c of cases ?? []) {
    if (c.status === "OPEN") stats.openCases += 1;
    else if (c.status === "DEFENSE") stats.defenseCases += 1;
    else if (c.status === "JUDGED") {
      stats.judgedCases += 1;
      if (c.verdict === "GUILTY") stats.verdicts.guilty += 1;
      else if (c.verdict === "NOT_GUILTY") stats.verdicts.notGuilty += 1;
      else if (c.verdict === "INSUFFICIENT_EVIDENCE") stats.verdicts.insufficient += 1;
    }
    stats.totalStaked += poolTotal(c.bet_totals);
  }
  return stats;
}

export function useLeaderboard(cases: Case[] | undefined) {
  return (cases ?? [])
    .map((c) => ({ caseData: c, pool: poolTotal(c.bet_totals) }))
    .filter((entry) => entry.pool > 0)
    .sort((a, b) => b.pool - a.pool)
    .slice(0, 10);
}

/* ------------------------------ mutations ------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["tribunal"] });
}

export function useFileCase() {
  const tribunal = useTribunal();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      plaintiff: string;
      defendant: string;
      title: string;
      description: string;
      evidenceUrls: string;
    }) =>
      tribunal.fileCase(
        input.plaintiff,
        input.defendant,
        input.title,
        input.description,
        input.evidenceUrls,
      ),
    onSuccess: invalidate,
  });
}

export function useSubmitDefense() {
  const tribunal = useTribunal();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { sender: string; caseId: number; text: string; urls: string }) =>
      tribunal.submitDefense(input.sender, input.caseId, input.text, input.urls),
    onSuccess: invalidate,
  });
}

export function usePlaceBet() {
  const tribunal = useTribunal();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { sender: string; caseId: number; outcome: Outcome; amount: number }) =>
      tribunal.placeBet(input.sender, input.caseId, input.outcome, input.amount),
    onSuccess: invalidate,
  });
}

export function useJudgeCase() {
  const tribunal = useTribunal();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { sender: string; caseId: number }) =>
      tribunal.judgeCase(input.sender, input.caseId),
    onSuccess: invalidate,
  });
}

export function useClaimWinnings() {
  const tribunal = useTribunal();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { sender: string; caseId: number }) =>
      tribunal.claimWinnings(input.sender, input.caseId),
    onSuccess: invalidate,
  });
}
