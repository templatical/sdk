import { describe, expect, it } from "vitest";
import { getScene } from "../src/scenes/index";
import { snippetChipKeys } from "../src/host/snippet-keys";

describe("snippetChipKeys", () => {
  it("minimum has no chips", () => {
    expect(snippetChipKeys(getScene("minimum")!.snippet)).toEqual([]);
  });

  it("saved-blocks lists the provider key", () => {
    expect(snippetChipKeys(getScene("saved-blocks")!.snippet)).toEqual([
      "savedBlocks",
    ]);
  });

  it("comments lists the composed keys in chip order", () => {
    expect(snippetChipKeys(getScene("comments")!.snippet)).toEqual([
      "templates",
      "comments",
    ]);
  });
});
