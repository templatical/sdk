import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SectionBlock } from "@templatical/types";
import { convertMjmlTemplate } from "../converter";

describe("convertMjmlTemplate input guards", () => {
  it("throws a typed message for a non-string input", () => {
    expect(() => convertMjmlTemplate(42 as unknown as string)).toThrow(
      "Invalid MJML template: expected a string. Pass the raw MJML source as a string.",
    );
  });

  it("throws a typed message for an empty string", () => {
    expect(() => convertMjmlTemplate("   \n  ")).toThrow(
      "Invalid MJML template: input is empty. Pass the raw MJML source of an email.",
    );
  });

  it("warns and returns no blocks when the document has an empty mj-body", () => {
    const result = convertMjmlTemplate("<mjml><mj-body></mj-body></mjml>");

    expect(result.content.blocks).toEqual([]);
    expect(result.report.warnings).toEqual([
      "No convertible content was found in the MJML. Check that the document has an <mj-body> with at least one <mj-section>.",
    ]);
    expect(result.report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults settings when the document declares none", () => {
    const { content } = convertMjmlTemplate("<mjml><mj-body></mj-body></mjml>");

    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect(content.settings.locale).toBe("en");
    expect(content.settings.preheaderText).toBeUndefined();
  });
});

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

describe("convertMjmlTemplate end to end", () => {
  it("reads settings from the head and body", () => {
    const { content } = convertMjmlTemplate(fixture("newsletter.mjml"));

    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#f4f4f4");
    expect(content.settings.fontFamily).toBe("Inter");
    expect(content.settings.textColor).toBe("#222222");
    expect(content.settings.linkColor).toBe("#0055ff");
    expect(content.settings.linkUnderline).toBe(false);
    expect(content.settings.preheaderText).toBe("This week in email");
    expect(content.settings.locale).toBe("en");
  });

  it("produces one top-level block per section, wrapper, fallback and loose run", () => {
    const { content } = convertMjmlTemplate(fixture("newsletter.mjml"));

    expect(content.blocks.map((b) => b.type)).toEqual([
      "section", // the mj-wrapper's section
      "section", // the two-column section
      "section", // the conditional section
      "html", // mj-hero fallback, wrapped in a section-less top-level block
      "section", // the loose mj-text, wrapped
    ]);
  });

  it("folds the wrapper into its section", () => {
    const { content } = convertMjmlTemplate(fixture("newsletter.mjml"));
    const first = content.blocks[0] as SectionBlock;

    expect(first.wrapper).toEqual({
      backgroundColor: "#ffffff",
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    });
    expect(first.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
      "image",
    ]);
  });

  it("attaches the display condition to the section between the raw guards", () => {
    const { content } = convertMjmlTemplate(fixture("newsletter.mjml"));

    expect(content.blocks[2].displayCondition).toEqual({
      label: "{% if subscriber.pro %}",
      before: "{% if subscriber.pro %}",
      after: "{% endif %}",
    });
  });

  it("wraps a loose mj-text in a one-column section", () => {
    const { content } = convertMjmlTemplate(fixture("newsletter.mjml"));
    const last = content.blocks[4] as SectionBlock;

    expect(last.columns).toBe("1");
    expect(last.styles.padding).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(last.children[0].map((b) => b.type)).toEqual(["paragraph"]);
  });

  it("summarises the report over every produced block", () => {
    const { report } = convertMjmlTemplate(fixture("newsletter.mjml"));

    expect(report.summary.total).toBe(report.entries.length);
    expect(report.summary.htmlFallback).toBe(1);
    expect(report.summary.skipped).toBe(0);
    expect(report.entries.filter((e) => e.sourceTag === "mj-raw")).toEqual([]);
    expect(report.entries.filter((e) => e.sourceTag === "mj-column")).toEqual(
      [],
    );
    expect(report.warnings).toEqual([]);
  });

  it("skips an mj-include and names the path", () => {
    const { report } = convertMjmlTemplate(
      '<mjml><mj-body><mj-include path="./h.mjml" /><mj-section><mj-column /></mj-section></mj-body></mjml>',
    );

    expect(report.summary.skipped).toBe(1);
    expect(report.entries[0].note).toContain("./h.mjml");
  });

  it("warns when the document has no mj-body at all", () => {
    const { content, report } = convertMjmlTemplate("<mjml><mj-head /></mjml>");

    expect(content.blocks).toEqual([]);
    expect(report.warnings).toContain(
      "No convertible content was found in the MJML. Check that the document has an <mj-body> with at least one <mj-section>.",
    );
  });
});
