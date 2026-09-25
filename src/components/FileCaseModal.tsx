"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FilePlus2, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useFileCase } from "@/lib/hooks/useMeridianTribunal";
import { useRequireWallet } from "@/lib/hooks/useRequireWallet";
import { errorMessage } from "@/lib/utils/format";

interface FileCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFiled?: (caseId: number) => void;
}

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export default function FileCaseModal({ open, onOpenChange, onFiled }: FileCaseModalProps) {
  const requireWallet = useRequireWallet();
  const fileCase = useFileCase();

  const [defendant, setDefendant] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = {
    defendant: !ETH_ADDRESS.test(defendant.trim())
      ? "A valid address is required"
      : "",
    title: title.trim().length < 6 ? "Give the case a clear title (6+ characters)" : "",
    description:
      description.trim().length < 40
        ? "Describe the dispute in at least 40 characters"
        : "",
    evidence:
      evidence.trim().length === 0
        ? "At least one evidence link is required"
        : evidence
            .split(",")
            .map((u) => u.trim())
            .filter(Boolean)
            .some((u) => !/^https?:\/\/.+\..+/.test(u))
          ? "Evidence must be valid links (comma separated)"
          : "",
  };

  const isValid = !errors.defendant && !errors.title && !errors.description && !errors.evidence;
  const mark = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const reset = () => {
    setDefendant("");
    setTitle("");
    setDescription("");
    setEvidence("");
    setTouched({});
  };

  const handleSubmit = async () => {
    setTouched({ defendant: true, title: true, description: true, evidence: true });
    if (!isValid) {
      toast.error("Please resolve the highlighted fields");
      return;
    }
    try {
      const sender = await requireWallet();
      if (defendant.trim().toLowerCase() === sender.toLowerCase()) {
        toast.error("You cannot file a case against yourself");
        return;
      }
      toast.loading("Filing case on the docket…", { id: "file" });
      const caseId = await fileCase.mutateAsync({
        plaintiff: sender,
        defendant: defendant.trim(),
        title: title.trim(),
        description: description.trim(),
        evidenceUrls: evidence.trim(),
      });
      toast.success("Case filed", {
        id: "file",
        description: "The dispute is now on the public docket.",
      });
      reset();
      onOpenChange(false);
      onFiled?.(caseId);
    } catch (err) {
      toast.error("Filing failed", { id: "file", description: errorMessage(err) });
    }
  };

  const fieldError = (key: keyof typeof errors) =>
    touched[key] && errors[key] ? <span className="field-error">{errors[key]}</span> : null;

  const invalidCls = (key: keyof typeof errors) =>
    touched[key] && errors[key] ? "invalid" : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel" style={{ width: "min(640px, calc(100vw - 32px))" }} aria-describedby={undefined}>
          <div className="modal-head">
            <div>
              <div className="t-kicker on-light" style={{ margin: 0 }}>
                New filing
              </div>
              <Dialog.Title className="modal-title">Bring a dispute forward</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="modal-close" type="button" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="modal-body" style={{ gap: 16 }}>
            <div className="field">
              <label className="field-label" htmlFor="defendant">
                Defendant address <span className="req">required</span>
              </label>
              <input
                id="defendant"
                value={defendant}
                onChange={(e) => setDefendant(e.target.value)}
                onBlur={() => mark("defendant")}
                className={invalidCls("defendant")}
                placeholder="0x…"
                spellCheck={false}
              />
              {fieldError("defendant")}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="case-title">
                Case title <span className="req">required</span>
              </label>
              <input
                id="case-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => mark("title")}
                className={invalidCls("title")}
                placeholder="A concise summary of the dispute"
                maxLength={200}
              />
              {fieldError("title")}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="case-description">
                Complaint description <span className="req">required</span>
              </label>
              <textarea
                id="case-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => mark("description")}
                className={invalidCls("description")}
                placeholder="What happened, what was agreed, and how it was breached…"
                maxLength={5000}
              />
              {fieldError("description")}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="case-evidence">
                Evidence links <span className="req">required · comma separated</span>
              </label>
              <input
                id="case-evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                onBlur={() => mark("evidence")}
                className={invalidCls("evidence")}
                placeholder="https://example.com/agreement, https://example.com/receipt"
                spellCheck={false}
              />
              <span className="field-hint">
                Validators will scrape these pages while deliberating.
              </span>
              {fieldError("evidence")}
            </div>

            <button
              type="button"
              className="btn btn-accent"
              onClick={handleSubmit}
              disabled={fileCase.isPending}
              style={{ minHeight: 52 }}
            >
              {fileCase.isPending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <FilePlus2 size={15} />
              )}
              File case
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
