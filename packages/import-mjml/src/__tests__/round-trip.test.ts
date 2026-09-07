import { describe, expect, it } from "vitest";
import { renderToMjml } from "@templatical/renderer";
import {
  createButtonBlock,
  createDividerBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  generateId,
} from "@templatical/types";
import type {
  Block,
  ParagraphBlock,
  TemplateContent,
} from "@templatical/types";
import { convertMjmlTemplate } from "../converter";

/**
 * One of every round-trippable block type, across all five column layouts,
 * plus a wrapper, a grouped section, a single-viewport visibility, a display
 * condition on a top-level section, a display condition on a block nested
 * inside a section column, and a paragraph carrying a hard `<br>` line break.
 *
 * Excluded on purpose (§12): `countdown` (Cloud renders it server-side),
 * `custom` (needs a consumer registry), `html` (indistinguishable from
 * paragraph in the output, §10), `video` (indistinguishable from a linked
 * image, §8.4c), any block hidden on all viewports (renders as ""), and any
 * image with an empty src (renders as nothing).
 */
function buildFixtureTemplate(): TemplateContent {
  const col = (blocks: Block[]) => blocks;

  return {
    blocks: [
      createSectionBlock({
        columns: "1",
        children: [
          col([
            createTitleBlock({
              content: "Welcome",
              level: 1,
              textAlign: "center",
            }),
            createParagraphBlock({
              content: "<p>Hello <strong>there</strong>.</p>",
            }),
            // Amendment 1: a hard break between two runs of text, pinning the
            // parser-mode fix (converter.ts's `xmlMode: false`) end to end —
            // a bare <br> must stay a void element rather than swallowing
            // "Line two" as its child.
            createParagraphBlock({
              content: "<p>Line one<br>Line two</p>",
            }),
          ]),
        ],
        wrapper: {
          backgroundColor: "#ffffff",
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
          borderRadius: 12,
        },
      }),
      createSectionBlock({
        columns: "2",
        children: [
          col([
            createImageBlock({
              src: "https://cdn.test/a.png",
              alt: "A",
              width: "full",
            }),
          ]),
          col([
            createButtonBlock({
              text: "Buy",
              url: "https://x.test",
              openInNewTab: true,
            }),
          ]),
        ],
      }),
      createSectionBlock({
        columns: "3",
        children: [
          col([createSpacerBlock({ height: 12 })]),
          col([
            createDividerBlock({
              thickness: 2,
              lineStyle: "dashed",
              color: "#cccccc",
            }),
          ]),
          col([
            createSocialIconsBlock({
              icons: [
                {
                  id: generateId(),
                  platform: "facebook",
                  url: "https://fb.test/a",
                },
                {
                  id: generateId(),
                  platform: "instagram",
                  url: "https://ig.test/a",
                },
              ],
              iconStyle: "circle",
              iconSize: "medium",
              spacing: 14,
            }),
          ]),
        ],
      }),
      createSectionBlock({
        columns: "1-2",
        children: [
          col([
            createMenuBlock({
              items: [
                {
                  id: generateId(),
                  text: "Home",
                  url: "/",
                  openInNewTab: false,
                  bold: false,
                  underline: false,
                },
                {
                  id: generateId(),
                  text: "Shop",
                  url: "/shop",
                  openInNewTab: true,
                  bold: false,
                  underline: false,
                },
              ],
            }),
          ]),
          col([
            createTableBlock({
              rows: [
                {
                  id: generateId(),
                  cells: [
                    { id: generateId(), content: "Item" },
                    { id: generateId(), content: "Qty" },
                  ],
                },
                {
                  id: generateId(),
                  cells: [
                    { id: generateId(), content: "Mug" },
                    { id: generateId(), content: "2" },
                  ],
                },
              ],
              hasHeaderRow: true,
            }),
          ]),
        ],
      }),
      createSectionBlock({
        columns: "2-1",
        stackOnMobile: false,
        children: [
          col([
            createParagraphBlock({
              content: "<p>Left</p>",
              visibility: { desktop: true, mobile: false },
            }),
          ]),
          col([
            createParagraphBlock({
              content: "<p>Right</p>",
              // A column-nested condition, not just the section-level one
              // below: the renderer wraps a conditional column child in the
              // same bracketing mj-raw guards as a top-level block
              // (renderer/src/renderers/section.ts), and recovering it needs
              // the same fold inside `convertColumnChildren` as `walkBody`
              // uses at top level (§8.5).
              displayCondition: {
                label: "{% if member %}",
                before: "{% if member %}",
                after: "{% endif %}",
              },
            }),
          ]),
        ],
      }),
      createSectionBlock({
        columns: "1",
        displayCondition: {
          label: "{% if pro %}",
          before: "{% if pro %}",
          after: "{% endif %}",
        },
        children: [col([createParagraphBlock({ content: "<p>Pro only</p>" })])],
      }),
    ],
    settings: {
      width: 600,
      backgroundColor: "#f4f4f4",
      textColor: "#222222",
      linkColor: "#0055ff",
      linkUnderline: false,
      fontFamily: "Inter",
      preheaderText: "Round trip",
      locale: "en",
    },
  };
}

/**
 * Strip everything the MJML output cannot carry, so the comparison is about
 * structure and values rather than identity.
 *
 * - every `id` (block, table row, table cell, social icon, menu item): absent
 *   from the output, so a re-import always mints fresh ones
 * - `displayCondition.label`: editor metadata, reconstructed rather than
 *   recovered (§8.5) — `before`/`after` are asserted separately, so dropping
 *   the label here cannot hide a lost condition
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (key === "id") continue;
      if (key === "displayCondition" && inner && typeof inner === "object") {
        const { label: _label, ...rest } = inner as Record<string, unknown>;
        out[key] = normalize(rest);
        continue;
      }
      out[key] = normalize(inner);
    }
    return out;
  }
  return value;
}

describe("round trip: renderToMjml -> convertMjmlTemplate", () => {
  it("reproduces the template structurally", async () => {
    const original = buildFixtureTemplate();
    const mjml = await renderToMjml(original);
    const { content } = convertMjmlTemplate(mjml);

    expect(normalize(content)).toEqual(normalize(original));
  });

  it("converts every element with no approximations at all", async () => {
    const mjml = await renderToMjml(buildFixtureTemplate());
    const { report } = convertMjmlTemplate(mjml);

    expect(report.summary.approximated).toBe(0);
    expect(report.summary.htmlFallback).toBe(0);
    expect(report.summary.skipped).toBe(0);
    expect(report.summary.converted).toBe(report.summary.total);
    expect(report.warnings).toEqual([]);
  });

  it("preserves a top-level section's display condition exactly", async () => {
    const mjml = await renderToMjml(buildFixtureTemplate());
    const { content } = convertMjmlTemplate(mjml);
    const conditional = content.blocks.find((b) => b.displayCondition);

    expect(conditional?.displayCondition?.before).toBe("{% if pro %}");
    expect(conditional?.displayCondition?.after).toBe("{% endif %}");
  });

  it("preserves a display condition nested inside a section column exactly", async () => {
    const mjml = await renderToMjml(buildFixtureTemplate());
    const { content } = convertMjmlTemplate(mjml);
    const nested = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : []))
      .find((b) => b.displayCondition);

    expect(nested?.displayCondition?.before).toBe("{% if member %}");
    expect(nested?.displayCondition?.after).toBe("{% endif %}");
  });

  it("preserves single-viewport visibility", async () => {
    const mjml = await renderToMjml(buildFixtureTemplate());
    const { content } = convertMjmlTemplate(mjml);
    const hidden = JSON.stringify(content).match(/"mobile":false/g);

    expect(hidden).toHaveLength(1);
  });

  it("preserves a hard <br> line break without duplicating or mis-nesting it", async () => {
    const mjml = await renderToMjml(buildFixtureTemplate());
    const { content } = convertMjmlTemplate(mjml);

    const paragraphs = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b): b is ParagraphBlock => b.type === "paragraph");
    const withBreak = paragraphs.find((p) => p.content.includes("Line one"));

    expect(withBreak?.content).toBe("<p>Line one<br>Line two</p>");
  });
});
