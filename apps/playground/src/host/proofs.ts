import manifest from "./proof-manifest.json";

export interface Proof {
  src: string;
  width: number;
  height: number;
}

/** Written by `scripts/capture-proofs.mjs`; `tests/proofs.test.ts` guards drift. */
const PROOFS: Record<string, Proof> = manifest;

export function proofFor(sceneId: string): Proof | undefined {
  return PROOFS[sceneId];
}

/**
 * The hero fan, left to right. The middle proof sits in front, so the dark
 * Sable sale anchors the fan between two light emails.
 */
export const HERO_PROOF_IDS = [
  "example-flowwork-newsletter",
  "example-sable-friday",
  "example-launchpad-launch",
] as const;
