import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../src/host/proof-manifest.json";
import { SCENES } from "../src/scenes/index";
import {
  PROOF_MAX_HEIGHT,
  PROOF_WIDTH,
  proofContentHash,
  proofSrc,
  // @ts-expect-error — plain .mjs helper shared with the capture script
} from "../scripts/proofs-lib.mjs";

const ROOT = join(import.meta.dirname, "..");
const RECAPTURE = "pnpm --filter @templatical/playground run capture:proofs";
const entries = manifest as Record<
  string,
  { src: string; width: number; height: number; contentHash: string }
>;
const examples = SCENES.filter((scene) => scene.group === "examples");

/** Canvas size from a WebP header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  expect(chunk).toBe("VP8X");
  return {
    width: bytes.readUIntLE(24, 3) + 1,
    height: bytes.readUIntLE(27, 3) + 1,
  };
}

describe("example proofs", () => {
  it("covers every Example scene and nothing else", () => {
    expect(Object.keys(entries).sort()).toEqual(
      examples.map((scene) => scene.id).sort(),
    );
  });

  it.each(examples.map((scene) => scene.id))(
    "%s has a WebP on disk at the recorded size",
    (id) => {
      const entry = entries[id]!;
      expect(entry.src).toBe(proofSrc(id));
      const file = join(ROOT, "public", entry.src);
      expect(existsSync(file), file).toBe(true);
      expect(webpSize(readFileSync(file))).toEqual({
        width: entry.width,
        height: entry.height,
      });
      expect(entry.width).toBe(PROOF_WIDTH);
      expect(entry.height).toBeLessThanOrEqual(PROOF_MAX_HEIGHT);
    },
  );

  it.each(examples.map((scene) => scene.id))(
    "%s proof was captured from the current template",
    (id) => {
      const scene = examples.find((candidate) => candidate.id === id)!;
      const hash = proofContentHash(
        scene.content({ search: new URLSearchParams() }),
      );
      expect(hash, `Stale proof. Run: ${RECAPTURE} ${id}`).toBe(
        entries[id]!.contentHash,
      );
    },
  );

  it("ignores the block ids minted on every content() call", () => {
    const scene = examples[0]!;
    const ctx = { search: new URLSearchParams() };
    const first = scene.content(ctx);
    const second = scene.content(ctx);
    expect(first.blocks[0]?.id).not.toBe(second.blocks[0]?.id);
    expect(proofContentHash(first)).toBe(proofContentHash(second));
  });

  it("changes when the template's visible content changes", () => {
    const scene = examples[0]!;
    const content = scene.content({ search: new URLSearchParams() });
    const before = proofContentHash(content);
    content.settings.backgroundColor = "#000000";
    expect(proofContentHash(content)).not.toBe(before);
  });
});
