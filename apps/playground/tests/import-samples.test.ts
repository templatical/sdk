import { describe, expect, it } from "vitest";
import { lintTemplate } from "@templatical/quality";
import type { Block, TemplateContent } from "@templatical/types";
import { convertImportSourceWithReport } from "../src/host/importConvert";
import { loadImportSample } from "../src/scenes/import/samples";
import type { ImportKind } from "../src/scenes/import/shared";

const KINDS: ImportKind[] = [
  "unlayer",
  "beefree",
  "stripo",
  "topol",
  "chamaileon",
  "easy-email-pro",
  "mjml",
  "html",
];

/** Plain HTML has no social block to map to; its sample links the three by name. */
const WITHOUT_SOCIAL_BLOCK = new Set<ImportKind>(["html"]);

function flatten(blocks: Block[]): Block[] {
  return blocks.flatMap((block) =>
    block.type === "section"
      ? [block, ...block.children.flatMap((column) => flatten(column))]
      : [block],
  );
}

function textOf(content: TemplateContent): string {
  return flatten(content.blocks)
    .map((block) => {
      if (block.type === "title" || block.type === "paragraph") {
        return block.content.replace(/<[^>]+>/g, " ");
      }
      if (block.type === "button") return block.text;
      return "";
    })
    .join(" ")
    .replace(/&nbsp;|\s+/g, " ");
}

describe.each(KINDS)("the %s sample", (kind) => {
  it("converts with no block falling back to raw HTML or dropped", async () => {
    const { report } = await convertImportSourceWithReport(
      kind,
      await loadImportSample(kind),
    );
    expect(report.summary.htmlFallback).toBe(0);
    expect(report.summary.skipped).toBe(0);
    expect(report.summary.converted).toBeGreaterThan(0);
  });

  it("carries the whole Launchpad email", async () => {
    const { content } = await convertImportSourceWithReport(
      kind,
      await loadImportSample(kind),
    );
    const text = textOf(content);
    for (const phrase of [
      "launchpad",
      "Introducing Launchpad v2.0",
      "We have been working on something big.",
      "new in v2.0",
      "Redesigned Dashboard",
      "Team Collaboration",
      "API v3",
      "Advanced Analytics",
      "Ready to upgrade?",
    ]) {
      expect(text, phrase).toContain(phrase);
    }

    const blocks = flatten(content.blocks);
    // Logo, headline, section heading: the same outline in every format.
    expect(
      blocks.flatMap((block) => (block.type === "title" ? [block.level] : [])),
    ).toEqual([3, 2, 3]);

    // The intro is centred in the source. A format whose importer drops
    // alignment set as an attribute has to carry it in the markup instead.
    const intro = blocks.find(
      (block) =>
        block.type === "paragraph" &&
        block.content.includes("We have been working"),
    );
    expect(
      intro?.type === "paragraph" &&
        /text-align:\s*center/.test(intro.content),
    ).toBe(true);

    const buttons = blocks.filter((block) => block.type === "button");
    expect(
      buttons.map((b) => (b.type === "button" ? [b.text, b.url] : [])),
    ).toEqual([
      ["See What’s New", "https://example.com/whats-new"],
      ["Open Your Dashboard", "https://example.com/dashboard"],
    ]);

    const image = blocks.find((block) => block.type === "image");
    expect(image?.type === "image" && image.src).toBe(
      "/examples/launchpad/dashboard.png",
    );
    expect(image?.type === "image" && image.alt).toBe(
      "Launchpad v2.0 dashboard",
    );

    // The two feature rows. A format that wraps every row in a section may
    // add one-column sections around them, which is fine.
    const twoColumn = content.blocks.filter(
      (block) => block.type === "section" && block.children.length === 2,
    );
    expect(twoColumn).toHaveLength(2);
    expect(blocks.some((block) => block.type === "divider")).toBe(true);

    const social = blocks.find((block) => block.type === "social");
    if (WITHOUT_SOCIAL_BLOCK.has(kind)) {
      expect(text).toContain("GitHub");
    } else {
      expect(
        social?.type === "social" && social.icons.map((icon) => icon.url),
      ).toEqual([
        "https://twitter.com/acme",
        "https://github.com/acme",
        "https://linkedin.com/company/acme",
      ]);
    }
  });

  it("lints with no errors once converted", async () => {
    const { content } = await convertImportSourceWithReport(
      kind,
      await loadImportSample(kind),
    );
    const errors = lintTemplate(content).filter(
      (issue) => issue.severity === "error",
    );
    expect(errors.map((issue) => issue.ruleId)).toEqual([]);
  });
});
