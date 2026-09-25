/**
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
  { slug: "juror-aegis", label: "Aegis", src: "/avatars/juror-aegis.svg" },
  { slug: "juror-vela", label: "Vela", src: "/avatars/juror-vela.svg" },
  { slug: "juror-orion", label: "Orion", src: "/avatars/juror-orion.svg" },
  { slug: "juror-lyra", label: "Lyra", src: "/avatars/juror-lyra.svg" },
  { slug: "juror-nomad", label: "Nomad", src: "/avatars/juror-nomad.svg" },
  { slug: "juror-atlas", label: "Atlas", src: "/avatars/juror-atlas.svg" },
] as const;

/** Stable pick by index, wrapping around the available artwork. */
export function avatarAt(index: number): GeneratedAvatar {
  return AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length];
}
