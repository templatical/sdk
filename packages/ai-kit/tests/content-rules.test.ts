import { describe, expect, it } from "vitest";
import {
  contentRuleRefusal,
  updateBlockRuleRefusal,
} from "../src/server/content-rules";

describe("content rules", () => {
  it("names a single forbidden block type without a list separator", () => {
    expect(
      contentRuleRefusal([{ id: "c1", type: "custom" }], new Map(), ["custom"]),
    ).toBe("you can't add custom blocks");
  });

  it("leaves missing or non-string update targets to the operation engine", () => {
    const existing = new Map([["t1", { id: "t1", type: "title" }]]);
    expect(
      updateBlockRuleRefusal({ blockId: 7, set: { type: "text" } }, existing),
    ).toBe(null);
    expect(
      updateBlockRuleRefusal({ blockId: "gone", unset: ["type"] }, existing),
    ).toBe(null);
  });
});
