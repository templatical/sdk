import { describe, expect, it } from "vitest";
import type { SectionBlock, SocialIconsBlock } from "@templatical/types";
import { convertTopolTemplate } from "../converter";
import { NEWSLETTER } from "./fixtures/newsletter";

const EMPTY_DESIGN = {
  tagName: "mj-global-style",
  attributes: {},
  children: [{ tagName: "mj-container", attributes: {}, children: [] }],
};

const INVALID_INPUT_MESSAGE =
  "Invalid Topol template: expected the design JSON object. If you fetched it from Topol's API, pass the response's \"json\" field.";

describe("convertTopolTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertTopolTemplate(42 as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for a malformed JSON string", () => {
    expect(() => convertTopolTemplate("{not json")).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for a null root", () => {
    expect(() => convertTopolTemplate(null as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for an array root", () => {
    expect(() => convertTopolTemplate([] as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message when the root tagName is wrong", () => {
    expect(() =>
      convertTopolTemplate({ tagName: "mj-container" } as never),
    ).toThrow(
      'Invalid Topol template: expected a root node with tagName "mj-global-style".',
    );
  });

  it("names the json fix when handed Topol's whole API response envelope", () => {
    expect(() =>
      convertTopolTemplate({
        id: "123",
        name: "My design",
        html: "<html></html>",
        json: EMPTY_DESIGN,
      } as never),
    ).toThrow(INVALID_INPUT_MESSAGE);
  });

  it("names the json fix when the envelope is passed as a JSON string", () => {
    expect(() =>
      convertTopolTemplate(
        JSON.stringify({
          id: "123",
          name: "My design",
          html: "<html></html>",
          json: EMPTY_DESIGN,
        }),
      ),
    ).toThrow(INVALID_INPUT_MESSAGE);
  });

  it("keeps the generic tagName message when the root has no json key", () => {
    expect(() =>
      convertTopolTemplate({
        id: "123",
        name: "My design",
        html: "<html></html>",
      } as never),
    ).toThrow(
      'Invalid Topol template: expected a root node with tagName "mj-global-style".',
    );
  });

  it("accepts a JSON string and parses it", () => {
    const { content } = convertTopolTemplate(JSON.stringify(EMPTY_DESIGN));
    expect(content.blocks).toEqual([]);
  });

  it("warns when the design has no convertible content", () => {
    const { report } = convertTopolTemplate(EMPTY_DESIGN);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Topol design. Check that the mj-container holds at least one mj-section.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the design declares none", () => {
    const { content } = convertTopolTemplate(EMPTY_DESIGN);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect("preheaderText" in content.settings).toBe(false);
  });
});

describe("convertTopolTemplate end to end", () => {
  it("reads settings from the global style and the container", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#f4f4f4");
    expect(content.settings.textColor).toBe("#222222");
    expect(content.settings.fontFamily).toBe("Ubuntu");
    expect(content.settings.linkColor).toBe("#0055ff");
  });

  it("produces one top-level block per section", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    expect(content.blocks.map((b) => b.type)).toEqual([
      "section",
      "section",
      "section",
    ]);
  });

  it("fills the first section's single column in document order", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    const first = content.blocks[0] as SectionBlock;
    expect(first.columns).toBe("1");
    expect(first.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
      "image",
    ]);
  });

  it("folds the four-column section to three and reports it", () => {
    const { content, report } = convertTopolTemplate(NEWSLETTER);
    const third = content.blocks[2] as SectionBlock;
    expect(third.columns).toBe("3");
    expect(third.children).toHaveLength(3);
    const approximated = report.entries.filter(
      (e) => e.status === "approximated",
    );
    expect(approximated.some((e) => e.sourceTag === "mj-section")).toBe(true);
  });

  it("imports only the social platforms named in display", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    const third = content.blocks[2] as SectionBlock;
    const social = third.children[2].find(
      (b) => b.type === "social",
    ) as SocialIconsBlock;
    expect(social.icons.map((i) => i.platform)).toEqual([
      "facebook",
      "twitter",
    ]);
  });

  it("summarises the report with no entry for containers or columns", () => {
    const { report } = convertTopolTemplate(NEWSLETTER);
    expect(report.entries.filter((e) => e.sourceTag === "mj-column")).toEqual(
      [],
    );
    expect(
      report.entries.filter((e) => e.sourceTag === "mj-container"),
    ).toEqual([]);
    expect(
      report.entries.filter((e) => e.sourceTag === "mj-global-style"),
    ).toEqual([]);
    // Three sections + 3 + 2 + 2 leaves. Counted by hand from the fixture —
    // never assert `summary.total === entries.length`, which is how `total` is
    // computed and so can never fail.
    expect(report.summary).toEqual({
      total: 10,
      converted: 9,
      approximated: 1,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("warns once about the dropped document line-height", () => {
    const { report } = convertTopolTemplate(NEWSLETTER);
    expect(report.warnings).toEqual([
      "Dropped the document line-height (1.6) — Templatical has no document-level line-height setting.",
    ]);
  });
});
