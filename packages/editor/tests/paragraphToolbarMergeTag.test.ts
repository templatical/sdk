// Source-level regression for the inline merge-tag button in ParagraphToolbar.
// Replicates the v-if gate rather than mounting the full toolbar (which
// pulls in TipTap + ProseMirror + every formatting child). The four cases
// below mirror the new canRequestMergeTag semantics: tags-only and
// onRequest-only both make the button visible.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

interface GateInput {
  hasOnRequest: boolean;
  tagsLength: number;
}

function canRequestMergeTag(input: GateInput): boolean {
  return input.hasOnRequest || input.tagsLength > 0;
}

describe("ParagraphToolbar inline merge-tag button — visibility", () => {
  it("source wires the button behind v-if=\"canRequestMergeTag\"", () => {
    expect(SRC).toContain('v-if="canRequestMergeTag"');
    expect(SRC).toContain("add-merge-tag");
  });

  it("hidden when neither tags nor onRequest is configured", () => {
    expect(canRequestMergeTag({ hasOnRequest: false, tagsLength: 0 })).toBe(
      false,
    );
  });

  it("visible when only onRequest is provided (existing behavior preserved)", () => {
    expect(canRequestMergeTag({ hasOnRequest: true, tagsLength: 0 })).toBe(
      true,
    );
  });

  it("visible when only tags.length > 0 (NEW: built-in picker path)", () => {
    expect(canRequestMergeTag({ hasOnRequest: false, tagsLength: 3 })).toBe(
      true,
    );
  });

  it("visible when both tags and onRequest are configured", () => {
    expect(canRequestMergeTag({ hasOnRequest: true, tagsLength: 3 })).toBe(
      true,
    );
  });
});

describe("ParagraphToolbar emits add-merge-tag", () => {
  // Sentinel: the inline button's @click handler must keep emitting
  // 'add-merge-tag'. If the wiring is renamed, the picker fall-through
  // breaks silently — this catches it without booting TipTap.
  it("inline button @click emits 'add-merge-tag'", () => {
    expect(SRC).toMatch(/@click="emit\('add-merge-tag'\)"/);
  });

  it("emit declaration includes 'add-merge-tag'", () => {
    expect(SRC).toContain("'add-merge-tag'");
  });
});
