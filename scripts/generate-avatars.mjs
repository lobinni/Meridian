#!/usr/bin/env node
/**
 * Avatar generator — Meridian Tribunal
 * ===================================
 *
 * Produces the hero network avatars as **deterministic SVG files** plus a
 * TypeScript manifest that the frontend imports.
 *
 * Why SVG instead of bitmaps?
 *  · Text files always survive `git add` (no binary/LFS surprises, no
 *    "image missing on Vercel" class of bugs).
 *  · A few hundred bytes each instead of ~150 KB — no CDN or image
 *    optimization dependency at all.
 *  · Fully deterministic: the same seed always renders the same portrait,
 *    so builds are reproducible.
 *
 * Outputs
 *  · public/avatars/<slug>.svg          — the artwork
 *  · src/lib/avatars.generated.ts       — typed manifest consumed by the UI
 *
 * Usage
 *   node scripts/generate-avatars.mjs           # generate
 *   node scripts/generate-avatars.mjs --check   # verify without writing
 *
 * It runs automatically before every build (`prebuild` script), so a fresh
 * clone or a CI deploy always has the artwork present.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "avatars");
const MANIFEST = join(ROOT, "src", "lib", "avatars.generated.ts");

const CHECK_ONLY = process.argv.includes("--check");

/* ------------------------------------------------------------------ */
/* Palette — matches the hero's ink + mint design tokens               */
/* ------------------------------------------------------------------ */

const INK = "#07110e";
const MINT = "#35d5b4";
const TEAL = "#087f71";
const SOFT = "#dff3eb";
const WARN = "#f0a74b";

/**
 * Each avatar is an abstract "juror" portrait: a shoulders + head
 * silhouette over a gradient disc, with a distinguishing motif.
 */
const AVATARS = [
  { slug: "juror-aegis", label: "Aegis", accent: MINT, motif: "visor", skin: "#123a33" },
  { slug: "juror-vela", label: "Vela", accent: SOFT, motif: "crest", skin: "#14463c" },
  { slug: "juror-orion", label: "Orion", accent: TEAL, motif: "shades", skin: "#0e2e28" },
  { slug: "juror-lyra", label: "Lyra", accent: MINT, motif: "circuit", skin: "#164c41" },
  { slug: "juror-nomad", label: "Nomad", accent: SOFT, motif: "hood", skin: "#0d2823" },
  { slug: "juror-atlas", label: "Atlas", accent: WARN, motif: "optic", skin: "#123a33" },
];

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Motif renderers (drawn inside a 100×100 viewBox)                    */
/* ------------------------------------------------------------------ */

function motifMarkup(motif, accent, rand) {
  const jitter = (n) => (rand() * n - n / 2).toFixed(2);

  switch (motif) {
    case "visor":
      return `
    <rect x="31" y="45" width="38" height="9" rx="4.5" fill="${accent}" opacity=".92"/>
    <circle cx="41" cy="49.5" r="1.9" fill="${INK}"/>
    <circle cx="59" cy="49.5" r="1.9" fill="${INK}"/>`;
    case "crest":
      return `
    <path d="M34 42 Q50 30 66 42" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="42" cy="50" r="2.6" fill="${accent}"/>
    <circle cx="58" cy="50" r="2.6" fill="${accent}"/>
    <path d="M44 60 Q50 64 56 60" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity=".75"/>`;
    case "shades":
      return `
    <path d="M30 47 H70" stroke="${accent}" stroke-width="2" opacity=".85"/>
    <rect x="32" y="45" width="15" height="10" rx="3" fill="${INK}" stroke="${accent}" stroke-width="1.6"/>
    <rect x="53" y="45" width="15" height="10" rx="3" fill="${INK}" stroke="${accent}" stroke-width="1.6"/>`;
    case "circuit":
      return `
    <circle cx="42" cy="49" r="2.4" fill="${accent}"/>
    <circle cx="58" cy="49" r="2.4" fill="${accent}"/>
    <path d="M30 38 H40 V33" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".7"/>
    <path d="M70 38 H60 V33" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".7"/>
    <path d="M44 61 H56" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`;
    case "hood":
      return `
    <path d="M27 52 Q50 18 73 52 Q62 40 50 40 Q38 40 27 52 Z" fill="${INK}" opacity=".85"/>
    <circle cx="43" cy="52" r="2.3" fill="${accent}" opacity=".95"/>
    <circle cx="57" cy="52" r="2.3" fill="${accent}" opacity=".95"/>`;
    case "optic":
    default:
      return `
    <circle cx="50" cy="49" r="8.5" fill="${INK}" stroke="${accent}" stroke-width="2.2"/>
    <circle cx="${(50 + Number(jitter(1.6))).toFixed(2)}" cy="49" r="3.4" fill="${accent}"/>
    <path d="M36 62 Q50 68 64 62" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`;
  }
}

function renderSvg({ slug, label, accent, motif, skin }) {
  const rand = rng(hash(slug));
  const gradId = `g-${slug}`;
  const ringId = `r-${slug}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="${gradId}" cx="38%" cy="28%" r="82%">
      <stop offset="0%" stop-color="${skin}"/>
      <stop offset="62%" stop-color="${INK}"/>
      <stop offset="100%" stop-color="#040a08"/>
    </radialGradient>
    <linearGradient id="${ringId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity=".95"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity=".15"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#${gradId})"/>
  <circle cx="50" cy="50" r="48.2" fill="none" stroke="url(#${ringId})" stroke-width="1.6"/>
  <!-- shoulders -->
  <path d="M18 100 Q22 74 50 74 Q78 74 82 100 Z" fill="${accent}" opacity=".16"/>
  <path d="M18 100 Q22 74 50 74 Q78 74 82 100" fill="none" stroke="${accent}" stroke-width="1.5" opacity=".5"/>
  <!-- head -->
  <path d="M34 44 Q34 26 50 26 Q66 26 66 44 Q66 64 50 70 Q34 64 34 44 Z" fill="${skin}" opacity=".95"/>
  <path d="M34 44 Q34 26 50 26 Q66 26 66 44 Q66 64 50 70 Q34 64 34 44 Z" fill="none" stroke="${accent}" stroke-width="1.5" opacity=".7"/>
  ${motifMarkup(motif, accent, rand)}
  <circle cx="50" cy="50" r="49.2" fill="none" stroke="#f8fcf9" stroke-opacity=".10" stroke-width="1"/>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

function renderManifest(list) {
  const entries = list
    .map(
      (a) =>
        `  { slug: "${a.slug}", label: "${a.label}", src: "/avatars/${a.slug}.svg" },`,
    )
    .join("\n");

  return `/**
 * AUTO-GENERATED FILE — do not edit by hand.
 * Regenerate with: npm run generate:avatars
 *
 * Source of truth: scripts/generate-avatars.mjs
 * The frontend imports this manifest, so adding or removing an avatar in the
 * generator automatically updates the interface on the next build.
 */

export interface GeneratedAvatar {
  slug: string;
  label: string;
  src: string;
}

export const AVATARS: readonly GeneratedAvatar[] = [
${entries}
] as const;

/** Stable pick by index, wrapping around the available artwork. */
export function avatarAt(index: number): GeneratedAvatar {
  return AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length];
}
`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

let written = 0;
let stale = 0;

mkdirSync(OUT_DIR, { recursive: true });

for (const avatar of AVATARS) {
  const target = join(OUT_DIR, `${avatar.slug}.svg`);
  const svg = renderSvg(avatar);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;

  if (current === svg) continue;
  stale += 1;
  if (!CHECK_ONLY) {
    writeFileSync(target, svg);
    written += 1;
  }
}

const manifest = renderManifest(AVATARS);
const currentManifest = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : null;
if (currentManifest !== manifest) {
  stale += 1;
  if (!CHECK_ONLY) {
    mkdirSync(dirname(MANIFEST), { recursive: true });
    writeFileSync(MANIFEST, manifest);
    written += 1;
  }
}

if (CHECK_ONLY) {
  if (stale > 0) {
    console.error(`✘ ${stale} avatar artifact(s) out of date — run: npm run generate:avatars`);
    process.exit(1);
  }
  console.log(`✔ Avatar artwork up to date (${AVATARS.length} avatars).`);
} else {
  console.log(
    `✔ Avatars ready — ${AVATARS.length} SVG(s) in public/avatars, manifest at src/lib/avatars.generated.ts` +
      (written ? ` (${written} file(s) updated)` : " (already current)"),
  );
}
