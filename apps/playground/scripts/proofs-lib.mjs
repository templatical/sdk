import { createHash } from "node:crypto";

/**
 * Catalog proofs: each Example scene's email, captured in the editor's
 * preview mode at its true width. Shared by `capture-proofs.mjs`, which
 * writes them, and `tests/proofs.test.ts`, which fails when a template
 * changes without its proof being recaptured.
 */
export const PROOF_WIDTH = 600;
/** Enough of the email for a tall tile; the full height would triple the bytes. */
export const PROOF_MAX_HEIGHT = 1400;
/** Relative to `apps/playground`. */
export const PROOF_DIR = "public/examples/proofs";
export const MANIFEST_PATH = "src/host/proof-manifest.json";

export function proofSrc(sceneId) {
  return `/examples/proofs/${sceneId}.webp`;
}

function withoutIds(value) {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, entry]) => [key, withoutIds(entry)]),
    );
  }
  return value;
}

/**
 * Fingerprint of the template a proof was captured from. Block ids are
 * minted fresh on every `content()` call, so they are left out; anything a
 * reader would see is in.
 */
export function proofContentHash(content) {
  return createHash("sha256")
    .update(JSON.stringify(withoutIds(content)))
    .digest("hex")
    .slice(0, 16);
}
