import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const REFERENCE_DIR = resolve(SKILL_ROOT, "reference");
const MANIFEST_PATH = resolve(REFERENCE_DIR, "manifest.json");
const REGEN_COMMAND =
  "pnpm --filter @templatical/sdk-skill run generate-reference";

interface Manifest {
  sdkVersion: string;
  pageCount: number;
  files: Record<string, string>;
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

/**
 * Every file under `dir`, relative to `dir` and `/`-joined — the same shape
 * tools/generate-reference.mjs uses for manifest.files keys, so a listing
 * here compares directly against those keys with no normalization step of
 * its own to get subtly out of sync with the generator's.
 */
function listFiles(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listFiles(abs, base));
      continue;
    }
    out.push(relative(base, abs).split(sep).join("/"));
  }
  return out;
}

/** Every committed page under reference/ — every file except the manifest itself. */
function listCommittedPages(): string[] {
  return listFiles(REFERENCE_DIR).filter((rel) => rel !== "manifest.json");
}

// Internal consistency only (design-notes/sdk-skill.md §5.2): nothing in this
// file reads apps/docs, and nothing regenerates anything. Freshness here
// means the committed reference/ tree still matches the manifest that was
// written alongside it — never a comparison against the docs site at HEAD,
// which would fail this suite on every unrelated docs PR.
describe("reference/ freshness", () => {
  // Hashing only what the manifest names would never notice a file that was
  // dropped into reference/ without ever being manifested — this direction
  // catches exactly that orphan case by comparing the directory listing
  // against manifest.json's keys, not by hashing.
  it("has no file under reference/ that manifest.json doesn't list", () => {
    const manifest = readManifest();
    const listed = new Set(Object.keys(manifest.files));
    const orphaned = listCommittedPages()
      .filter((page) => !listed.has(page))
      .sort();
    expect(
      orphaned,
      `File(s) committed under reference/ with no manifest.json entry: ${orphaned.join(", ")}. ` +
        `Run \`${REGEN_COMMAND}\`.`,
    ).toEqual([]);
  });

  // The mirror image: a manifest entry surviving a page that no longer
  // exists (deleted or renamed out from under it) — caught here rather than
  // in the hash loop below so the failure names the file directly instead
  // of surfacing as a raw ENOENT.
  it("has no manifest.json entry naming a file that isn't committed", () => {
    const manifest = readManifest();
    const committed = new Set(listCommittedPages());
    const dangling = Object.keys(manifest.files)
      .filter((page) => !committed.has(page))
      .sort();
    expect(
      dangling,
      `manifest.json lists file(s) that no longer exist under reference/: ${dangling.join(", ")}. ` +
        `Run \`${REGEN_COMMAND}\`.`,
    ).toEqual([]);
  });

  it("every manifested file's sha256 matches its committed content", () => {
    const manifest = readManifest();
    const mismatched: string[] = [];
    for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
      const abs = join(REFERENCE_DIR, relPath);
      // A missing file is already reported, with a clearer message, by the
      // "isn't committed" test above — skip it here rather than throwing.
      if (!existsSync(abs)) continue;
      const actualHash = createHash("sha256")
        .update(readFileSync(abs))
        .digest("hex");
      if (actualHash !== expectedHash) mismatched.push(relPath);
    }
    expect(
      mismatched,
      "Committed file(s) no longer match the hash manifest.json recorded for them — hand-edited " +
        `since generation: ${mismatched.join(", ")}. Run \`${REGEN_COMMAND}\`.`,
    ).toEqual([]);
  });

  it("declares the page count it actually lists", () => {
    const manifest = readManifest();
    expect(manifest.pageCount).toBe(Object.keys(manifest.files).length);
  });
});
