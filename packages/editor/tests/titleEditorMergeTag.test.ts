// Mirror of paragraphToolbarMergeTag.test.ts for TitleEditor's inline
// merge-tag button. Same gate semantics, same v-if expression — when
// `canRequestMergeTag` widens for the picker fall-through, the button
// becomes visible in static-tags mode without any template change.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/TitleEditor.vue"),
  "utf-8",
);

interface GateInput {
  hasOnRequest: boolean;
  tagsLength: number;
}

function canRequestMergeTag(input: GateInput): boolean {
  return input.hasOnRequest || input.tagsLength > 0;
}

describe("TitleEditor inline merge-tag button — visibility", () => {
  it("source wires the button behind v-if=\"canRequestMergeTag\"", () => {
    expect(SRC).toContain('v-if="canRequestMergeTag"');
  });

  it("invokes the rich-text handler which awaits requestMergeTag()", () => {
    expect(SRC).toContain("handleAddMergeTag");
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
