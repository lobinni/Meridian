"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  LoaderCircle,
  Scale,
  ShieldCheck,
  Swords,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Case } from "@/lib/contracts/types";
import BettingPanel from "./BettingPanel";
import { StatusChip, VerdictBadge, SeverityMeter } from "./ui-bits";
import { caseCode, errorMessage } from "@/lib/utils/format";
import { shortenAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useRequireWallet } from "@/lib/hooks/useRequireWallet";
import {
  useCase,
  useCaseBet,
  useJudgeCase,
  useSubmitDefense,
} from "@/lib/hooks/useMeridianTribunal";
import { useAppConfig } from "@/lib/useAppConfig";

interface CaseDetailProps {
  caseId: number | null;
  onClose: () => void;
}

export default function CaseDetail({ caseId, onClose }: CaseDetailProps) {
  const wallet = useWallet();
  const { data: caseData } = useCase(caseId);
  const { data: userBet } = useCaseBet(caseId, wallet.address);

  return (
    <Dialog.Root open={caseId !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel" aria-describedby={undefined}>
          {caseData ? (
            <CaseBody
              caseData={caseData}
              address={wallet.address}
              userBetOutcome={userBet}
              onClose={onClose}
            />
          ) : (
            <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
              <LoaderCircle size={28} className="animate-spin" style={{ color: "var(--t-accent-dark)" }} />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CaseBody({
  caseData: c,
  address,
  userBetOutcome,
  onClose,
}: {
  caseData: Case;
  address: string | null;
  userBetOutcome: ReturnType<typeof useCaseBet>["data"];
  onClose: () => void;
}) {
  const isDefendant =
    !!address && c.defendant.toLowerCase() === address.toLowerCase();

  return (
    <>
      <div className="modal-head">
        <div>
          <div className="t-kicker on-light" style={{ margin: 0 }}>
            Case file {caseCode(c.id)}
          </div>
          <Dialog.Title className="modal-title">{c.title}</Dialog.Title>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusChip status={c.status} />
          <VerdictBadge verdict={c.verdict} />
          <Dialog.Close asChild>
            <button className="modal-close" type="button" aria-label="Close case file" onClick={onClose}>
              <X size={16} />
            </button>
          </Dialog.Close>
        </div>
      </div>

      <div className="modal-body">
        <Timeline status={c.status} />

        <Parties plaintiff={c.plaintiff} defendant={c.defendant} isDefendant={isDefendant} />

        <Section icon={<FileText size={13} />} label="Plaintiff's complaint">
          <p style={proseStyle}>{c.description}</p>
          <EvidenceLinks urls={c.evidence_urls} />
        </Section>

        {c.status === "OPEN" ? (
          isDefendant ? (
            <DefenseForm caseId={c.id} />
          ) : (
            <div className="list-state" style={{ padding: "30px 20px" }}>
              <ShieldCheck size={22} />
              <div className="t">Awaiting the defendant&apos;s response</div>
              <p>
                The defendant must mount a defense before the tribunal can be
                summoned. Stakes remain open in the meantime.
              </p>
            </div>
          )
        ) : (
          <Section icon={<ShieldCheck size={13} />} label="Defendant's response">
            <p style={proseStyle}>{c.defense_text || "No defense was recorded."}</p>
            <EvidenceLinks urls={c.defense_urls} />
          </Section>
        )}

        {c.status === "JUDGED" ? (
          <div className="judgment">
            <div className="judgment-row">
              <div>
                <div className="t-kicker">Tribunal verdict</div>
                <VerdictBadge verdict={c.verdict} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="stat-label" style={{ color: "#f8fcf966" }}>
                  Severity assessment
                </div>
                <div style={{ marginTop: 8 }}>
                  <SeverityMeter value={c.severity} />
                </div>
              </div>
            </div>
            <p className="judgment-reasoning">{c.reasoning}</p>
          </div>
        ) : null}

        <BettingPanel caseData={c} userBet={userBetOutcome} address={address} />

        {c.status === "DEFENSE" ? <JudgeTrigger caseId={c.id} /> : null}
      </div>
    </>
  );
}

const proseStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.8,
  color: "var(--t-ink)",
  margin: 0,
  opacity: 0.86,
};

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="t-card" style={{ padding: 20 }}>
      <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "var(--t-accent-dark)" }}>{icon}</span>
        <span
          style={{
            font: "500 10px/1 var(--font-dm-mono), monospace",
            letterSpacing: ".065em",
            textTransform: "uppercase",
            color: "var(--t-muted)",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Timeline({ status }: { status: Case["status"] }) {
  const stage = status === "OPEN" ? 0 : status === "DEFENSE" ? 1 : 2;
  const steps = [
    { label: "Filed", desc: "Complaint on record" },
    { label: "Defense", desc: "Counter-arguments mounted" },
    { label: "Verdict", desc: "AI consensus rendered" },
  ];
  return (
    <div className="t-timeline">
      {steps.map((s, i) => (
        <div
          key={s.label}
          className={`t-step ${i <= stage ? "done" : ""} ${i === stage ? "now" : ""}`}
        >
          <span className="step-label">
            <i /> Step {i + 1} · {s.label}
          </span>
          <div className="step-desc">{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

function Parties({
  plaintiff,
  defendant,
  isDefendant,
}: {
  plaintiff: string;
  defendant: string;
  isDefendant: boolean;
}) {
  const party = (
    icon: React.ReactNode,
    role: string,
    value: string,
    highlight: boolean,
  ) => (
    <div
      style={{
        border: `1px solid ${highlight ? "var(--t-accent-dark)" : "var(--t-line)"}`,
        background: highlight ? "var(--t-accent-soft)" : "var(--t-paper)",
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--t-line)",
          color: "var(--t-accent-dark)",
          flex: "none",
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "500 9px/1 var(--font-dm-mono), monospace",
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "var(--t-muted)",
          }}
        >
          {role} {highlight ? "· you" : ""}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 6,
            font: "500 12px/1 var(--font-dm-mono), monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shortenAddress(value)}
        </span>
      </span>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
      {party(<UserRound size={16} />, "Plaintiff", plaintiff, false)}
      <span
        style={{
          width: 34,
          height: 34,
          display: "grid",
          placeItems: "center",
          border: "1px dashed var(--t-line)",
          color: "var(--t-faint)",
        }}
      >
        <Swords size={14} />
      </span>
      {party(<Landmark size={16} />, "Defendant", defendant, isDefendant)}
    </div>
  );
}

function EvidenceLinks({ urls }: { urls: string }) {
  const list = urls
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!list.length) {
    return (
      <p
        style={{
          font: "400 10px/1.6 var(--font-dm-mono), monospace",
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--t-faint)",
          margin: "12px 0 0",
        }}
      >
        No linked evidence
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
      {list.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="chip"
          style={{ textDecoration: "none", cursor: "pointer" }}
        >
          <Link2 size={10} />
          {url.replace(/^https?:\/\//, "").slice(0, 34)}
          <ExternalLink size={9} />
        </a>
      ))}
    </div>
  );
}

function DefenseForm({ caseId }: { caseId: number }) {
  const requireWallet = useRequireWallet();
  const submitDefense = useSubmitDefense();
  const [text, setText] = useState("");
  const [urls, setUrls] = useState("");
  const textValid = text.trim().length >= 20;

  const handleSubmit = async () => {
    try {
      const sender = await requireWallet();
      if (!textValid) {
        toast.error("Defense must be at least 20 characters");
        return;
      }
      toast.loading("Submitting defense…", { id: "defense" });
      await submitDefense.mutateAsync({ sender, caseId, text: text.trim(), urls: urls.trim() });
      toast.success("Defense recorded", { id: "defense" });
      setText("");
      setUrls("");
    } catch (err) {
      toast.error("Defense failed", { id: "defense", description: errorMessage(err) });
    }
  };

  return (
    <div className="t-card" style={{ padding: 20, borderColor: "var(--t-accent-dark)", background: "var(--t-accent-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Scale size={14} style={{ color: "var(--t-accent-dark)" }} />
        <span
          style={{
            font: "500 10px/1 var(--font-dm-mono), monospace",
            letterSpacing: ".065em",
            textTransform: "uppercase",
            color: "var(--t-ink)",
          }}
        >
          You are the defendant — mount your defense
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor="defense-text">
            Defense statement <span className="req">required</span>
          </label>
          <textarea
            id="defense-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={text.length > 0 && !textValid ? "invalid" : ""}
            placeholder="Present your counter-arguments clearly and factually…"
          />
          {text.length > 0 && !textValid ? (
            <span className="field-error">At least 20 characters</span>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="defense-urls">
            Counter-evidence links <span>optional, comma separated</span>
          </label>
          <input
            id="defense-urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://example.com/receipt, https://example.com/logs"
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={handleSubmit}
          disabled={submitDefense.isPending}
        >
          {submitDefense.isPending ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <ShieldCheck size={14} />
          )}
          Submit defense
        </button>
      </div>
    </div>
  );
}

function JudgeTrigger({ caseId }: { caseId: number }) {
  const requireWallet = useRequireWallet();
  const { nativeSymbol } = useAppConfig();
  const judgeCase = useJudgeCase();

  const handleJudge = async () => {
    try {
      const sender = await requireWallet();
      toast.loading(
        "Summoning the tribunal — validators are scraping evidence and deliberating…",
        { id: "judge", duration: 60_000 },
      );
      await judgeCase.mutateAsync({ sender, caseId });
      toast.success("Verdict rendered by consensus", { id: "judge" });
    } catch (err) {
      toast.error("Judgment failed", { id: "judge", description: errorMessage(err) });
    }
  };

  return (
    <div className="judgment" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
      <div style={{ position: "relative" }}>
        <div className="t-kicker" style={{ marginBottom: 8 }}>
          Judgment chamber
        </div>
        <p style={{ color: "#f8fcf9a6", fontSize: 13, lineHeight: 1.7, margin: 0, maxWidth: 420 }}>
          Both sides are on record. Summon the tribunal and independent AI
          validators will scrape the evidence, deliberate, and render a final
          verdict {nativeSymbol} stakes settle instantly after.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-accent"
        onClick={handleJudge}
        disabled={judgeCase.isPending}
        style={{ position: "relative", minHeight: 52 }}
      >
        {judgeCase.isPending ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : (
          <Scale size={15} />
        )}
        {judgeCase.isPending ? "Deliberating…" : "Summon verdict"}
      </button>
    </div>
  );
}
