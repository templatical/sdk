import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type { SectionBlock } from "@templatical/types";
import { buildAttributeCascade, findByTag } from "../attribute-resolver";
import {
  buildSection,
  buildWrapper,
  matchColumnLayout,
} from "../section-builder";
import type { ConvertContext } from "../block-base";
import type { ImportReportEntry } from "../types";

function build(markup: string, which: "section" | "wrapper" = "section") {
  const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
    xml: { xmlMode: false, recognizeSelfClosing: true },
  });
  const ctx: ConvertContext = {
    $,
    cascade: buildAttributeCascade($),
    containerWidth: 600,
    warnings: [],
  };
  const entries: ImportReportEntry[] = [];
  const $el = findByTag(
    $,
    which === "section" ? "mj-section" : "mj-wrapper",
  ).first() as unknown as Cheerio<Element>;
  const blocks =
    which === "section"
      ? buildSection($el, ctx, entries)
      : buildWrapper($el, ctx, entries);
  return { blocks, entries, ctx };
}

describe("matchColumnLayout", () => {
  it("matches a single full-width column", () => {
    expect(matchColumnLayout([100])).toEqual({ layout: "1", exact: true });
  });

  it("matches an even two-column split", () => {
    expect(matchColumnLayout([50, 50])).toEqual({ layout: "2", exact: true });
  });

  it("matches the renderer's three-column widths, rounding gap included", () => {
    expect(matchColumnLayout([33.33, 33.33, 33.34])).toEqual({
      layout: "3",
      exact: true,
    });
  });

  it("matches a narrow-then-wide split", () => {
    expect(matchColumnLayout([33.33, 66.67])).toEqual({
      layout: "1-2",
      exact: true,
    });
  });

  it("matches a wide-then-narrow split", () => {
    expect(matchColumnLayout([66.67, 33.33])).toEqual({
      layout: "2-1",
      exact: true,
    });
  });

  it("tolerates two points of drift in hand-written widths", () => {
    expect(matchColumnLayout([34, 66])).toEqual({ layout: "1-2", exact: true });
  });

  it("distributes equally when no widths are given", () => {
    expect(matchColumnLayout([null, null])).toEqual({
      layout: "2",
      exact: true,
    });
  });

  it("approximates a two-column ratio outside the tolerance", () => {
    expect(matchColumnLayout([25, 75])).toEqual({
      layout: "1-2",
      exact: false,
    });
  });

  it("approximates a three-column ratio outside the tolerance", () => {
    expect(matchColumnLayout([20, 20, 60])).toEqual({
      layout: "3",
      exact: false,
    });
  });

  it("approximates four or more columns down to three", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "3",
      exact: false,
    });
  });
});

describe("buildSection", () => {
  it("builds a one-column section with its children", () => {
    const { blocks, entries } = build(
      '<mj-section background-color="#eeeeee" padding="20px"><mj-column><mj-spacer height="8px" /></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(blocks).toHaveLength(1);
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#eeeeee");
    expect(section.styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    });
    expect(section.children).toHaveLength(1);
    expect(section.children[0]).toHaveLength(1);
    expect(section.children[0][0].type).toBe("spacer");
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
    ]);
  });

  it("emits no entry for mj-column itself", () => {
    const { entries } = build(
      "<mj-section><mj-column /><mj-column /></mj-section>",
    );
    expect(entries.filter((e) => e.sourceTag === "mj-column")).toEqual([]);
  });

  it("reads border radius", () => {
    const { blocks } = build(
      '<mj-section border-radius="12px"><mj-column /></mj-section>',
    );
    expect((blocks[0] as SectionBlock).borderRadius).toBe(12);
  });

  it("omits borderRadius when the attribute is absent", () => {
    const { blocks } = build("<mj-section><mj-column /></mj-section>");
    expect("borderRadius" in blocks[0]).toBe(false);
  });

  it("reads stackOnMobile false from an mj-group", () => {
    const { blocks } = build(
      '<mj-section><mj-group><mj-column width="50%" /><mj-column width="50%" /></mj-group></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.stackOnMobile).toBe(false);
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
  });

  it("omits stackOnMobile when there is no mj-group", () => {
    const { blocks } = build("<mj-section><mj-column /></mj-section>");
    expect("stackOnMobile" in blocks[0]).toBe(false);
  });

  it("reports an approximated layout with the original widths in the note", () => {
    const { entries } = build(
      '<mj-section><mj-column width="25%" /><mj-column width="75%" /></mj-section>',
    );
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      'Column widths 25%, 75% have no exact Templatical layout; resolved to "1-2".',
    );
  });

  it("folds a fourth column's children into the third", () => {
    const { blocks } = build(`
      <mj-section>
        <mj-column><mj-spacer height="1px" /></mj-column>
        <mj-column><mj-spacer height="2px" /></mj-column>
        <mj-column><mj-spacer height="3px" /></mj-column>
        <mj-column><mj-spacer height="4px" /></mj-column>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children[2]).toHaveLength(2);
  });

  it("refuses a nested section, falling it back to html", () => {
    const { blocks, entries } = build(
      "<mj-section><mj-column><mj-section><mj-column /></mj-section></mj-column></mj-section>",
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0][0].type).toBe("html");
    const entry = entries.find((e) => e.status === "html-fallback")!;
    expect(entry.note).toBe(
      "MJML forbids <mj-section> inside <mj-column>; the nested section's markup is preserved as an html block.",
    );
  });

  it("passes the column width down as the container width for images", () => {
    const { blocks } = build(
      '<mj-section><mj-column width="50%"><mj-image src="a.png" width="300px" /></mj-column><mj-column width="50%" /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0][0]).toMatchObject({
      type: "image",
      width: "full",
    });
  });

  it("keeps document order across sections sharing one report array", () => {
    // `entries` is the document-wide report the whole walk shares, not a
    // per-section list — a document walker (Task 10) calls `buildSection`
    // once per top-level <mj-section>, passing the same array through every
    // call. Each section's own entry must land ahead of its own children AND
    // ahead of the next section's entry — document order, children nested
    // under their own parent — not retroactively spliced to the very front
    // of everything already collected.
    const markup = `
      <mj-section><mj-column><mj-spacer height="1px" /></mj-column></mj-section>
      <mj-section><mj-column><mj-spacer height="2px" /></mj-column></mj-section>
    `;
    const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
      xml: { xmlMode: false, recognizeSelfClosing: true },
    });
    const ctx: ConvertContext = {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      warnings: [],
    };
    const entries: ImportReportEntry[] = [];

    for (const el of findByTag($, "mj-section").toArray()) {
      buildSection($(el) as unknown as Cheerio<Element>, ctx, entries);
    }

    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
      "mj-section",
      "mj-spacer",
    ]);
  });
});

describe("buildWrapper", () => {
  it("folds a single-section wrapper into that section's wrapper field", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-color="#111111" padding="30px" border-radius="16px"><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;

    expect(blocks).toHaveLength(1);
    expect(section.type).toBe("section");
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      padding: { top: 30, right: 30, bottom: 30, left: 30 },
      borderRadius: 16,
    });
    expect(entries.some((e) => e.sourceTag === "mj-wrapper")).toBe(false);
  });

  it("applies the wrapper to every section and reports the approximation", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-color="#111111"><mj-section><mj-column /></mj-section><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );

    expect(blocks).toHaveLength(2);
    expect((blocks[0] as SectionBlock).wrapper?.backgroundColor).toBe(
      "#111111",
    );
    expect((blocks[1] as SectionBlock).wrapper?.backgroundColor).toBe(
      "#111111",
    );

    const entry = entries.find((e) => e.sourceTag === "mj-wrapper")!;
    expect(entry).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: "An <mj-wrapper> holding 2 sections was applied to each of them — Templatical has no multi-section band.",
    });

    // The wrapper's entry is pushed before the `flatMap` that calls
    // `buildSection` once per section, and each of those pushes its own
    // entry immediately — so the wrapper leads, followed by both sections in
    // document order.
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-wrapper",
      "mj-section",
      "mj-section",
    ]);
  });
});
