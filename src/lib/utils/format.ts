/** Small display helpers shared across the UI. */

export function formatGEN(amount: number, maxDecimals = 2): string {
  if (!Number.isFinite(amount)) return "0";
  const rounded = Math.abs(amount) < 0.001 && amount !== 0 ? 0.001 : amount;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      error?: { message?: unknown };
      data?: { message?: unknown };
      reason?: unknown;
      code?: unknown;
    };
    const msg =
      (typeof e.message === "string" && e.message) ||
      (typeof e.error?.message === "string" && e.error.message) ||
      (typeof e.data?.message === "string" && e.data.message) ||
      (typeof e.reason === "string" && e.reason) ||
      null;
    if (msg) return e.code !== undefined ? `${msg} (code ${String(e.code)})` : msg;
    try {
      return JSON.stringify(err);
    } catch {
      /* fall through */
    }
  }
  return "Unexpected error";
}

/** Numeric padding for case identifiers. */
export function caseCode(id: number): string {
  return `#${String(id).padStart(3, "0")}`;
}

/** Deterministic hue from a wallet address for avatar accents. */
export function addressHue(address: string): number {
  let h = 0;
  for (let i = 2; i < Math.min(address.length, 10); i++) {
    h = (h * 31 + address.charCodeAt(i)) % 360;
  }
  return h;
}

export function avatarInitials(address: string): string {
  return address.replace(/^0x/i, "").slice(0, 2).toUpperCase();
}
