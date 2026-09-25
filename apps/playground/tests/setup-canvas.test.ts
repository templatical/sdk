import { describe, expect, it } from "vitest";
import { lintTemplate } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";
import { getScene } from "../src/scenes/index";
import { issuesCanvas, setupBaseCanvas } from "../src/scenes/author/shared";
import { storageCanvas } from "../src/scenes/storage/canvas";

const noQuery = { search: new URLSearchParams() };

function actionableRuleIds(content: TemplateContent): string[] {
  return lintTemplate(content)
    .filter((issue) => issue.severity !== "info")
    .map((issue) => issue.ruleId)
    .sort();
}

describe("setupBaseCanvas", () => {
  const base = setupBaseCanvas();

  it("drops the features its scenes do not register", () => {
    expect(base.blocks.some((block) => block.type === "custom")).toBe(false);
    expect(base.blocks.some((block) => block.displayCondition)).toBe(false);
    expect(JSON.stringify(base)).not.toContain("data-merge-tag");
    expect(JSON.stringify(base)).toContain("Hi there,");
  });

  it("is still a finished email: hero image, two buttons, feature grid", () => {
    const types = base.blocks.map((block) => block.type);
    expect(types).toContain("image");
    expect(types.filter((type) => type === "button")).toHaveLength(2);
    expect(types.filter((type) => type === "section")).toHaveLength(2);
    expect(base.settings.preheaderText).toMatch(/Launchpad v2\.0/);
  });

  it("lints clean at warning and above", () => {
    expect(actionableRuleIds(base)).toEqual([]);
  });
});

describe("issuesCanvas", () => {
  it("plants exactly a missing alt and a vague button label", () => {
    expect(actionableRuleIds(issuesCanvas())).toEqual([
      "a11y.button-vague-label",
      "a11y.img-missing-alt",
    ]);
  });

  it("is what the Issues scene opens on, with a blank canvas on request", () => {
    const scene = getScene("issues")!;
    expect(actionableRuleIds(scene.content(noQuery))).toHaveLength(2);
    const blank = scene.content({
      search: new URLSearchParams("canvas=blank"),
    });
    expect(blank.blocks).toEqual([]);
  });
});

describe("seeded setup scenes", () => {
  it.each(["fonts", "defaults", "theming", "layout", "shadow-dom-off"])(
    "%s opens on the base email",
    (id) => {
      const blocks = getScene(id)!.content(noQuery).blocks;
      expect(blocks.map((block) => block.type)).toEqual(
        setupBaseCanvas().blocks.map((block) => block.type),
      );
    },
  );

  // Minimum is the blank editor by definition; i18n demonstrates localized
  // placeholders on insert; media's specs drop images onto an empty canvas.
  it.each(["minimum", "i18n", "media"])("%s still opens empty", (id) => {
    expect(getScene(id)!.content(noQuery).blocks).toEqual([]);
  });
});

describe("storageCanvas", () => {
  it("keeps the structure the saved-blocks e2e relies on", () => {
    const content = storageCanvas();
    expect(content.blocks.map((block) => block.type)).toEqual([
      "title",
      "paragraph",
      "title",
      "section",
    ]);
    const section = content.blocks[3];
    expect(section?.type === "section" && section.children).toHaveLength(1);
    expect(
      section?.type === "section" && section.children[0]?.map((b) => b.type),
    ).toEqual(["paragraph"]);
  });

  it("reads like a real email, not fixture labels", () => {
    const json = JSON.stringify(storageCanvas());
    expect(json).toContain("Your March product update");
    expect(json).not.toMatch(
      /Storage heading|Second heading|Nested in a section/,
    );
  });
});
