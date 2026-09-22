import { describe, expect, it } from "vitest";
import { getScene } from "../src/scenes/index";
import { catalogInitKey, snippetChipKeys } from "../src/host/snippet-keys";

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

describe("catalogInitKey", () => {
  it("omits a key that restates the title", () => {
    const scene = getScene("fonts")!;
    expect(catalogInitKey(scene.title, scene.snippet)).toBeNull();
  });

  it("keeps a key the title does not say", () => {
    const scene = getScene("i18n")!;
    expect(catalogInitKey(scene.title, scene.snippet)).toBe("locale");
  });

  it("omits blockDefaults under Defaults", () => {
    const scene = getScene("defaults")!;
    expect(catalogInitKey(scene.title, scene.snippet)).toBeNull();
  });
});
