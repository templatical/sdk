import { elementIdIssues } from "@templatical/types";
import { describe, expect, it } from "vitest";
import type {
  ParagraphBlock,
  SectionBlock,
  SocialIconsBlock,
} from "@templatical/types";
import { convertTopolTemplate } from "../converter";
import { NEWSLETTER } from "./fixtures/newsletter";

const EMPTY_DESIGN = {
  tagName: "mj-global-style",
  attributes: {},
  children: [{ tagName: "mj-container", attributes: {}, children: [] }],
};

const make = (rootTag: string) => ({
  tagName: "mj-global-style",
  attributes: {},
  children: [
    {
      tagName: rootTag,
      attributes: {},
      children: [
        {
          tagName: "mj-section",
          attributes: {},
          children: [
            {
              tagName: "mj-column",
              attributes: { width: "100%" },
              children: [
                { tagName: "mj-text", attributes: {}, content: "<p>Hi</p>" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const withoutIds = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (key: string, item: unknown) =>
      key === "id" ? undefined : item,
    ),
  );

const INVALID_INPUT_MESSAGE =
  'Invalid Topol template: expected the design JSON object — Topol hands you this directly from its editor\'s onSave callback, or under "definition" (template API) or "json" (predefined-templates API) in its API response.';

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

  it("names the definition fix when handed Topol's template-retrieval envelope", () => {
    expect(() =>
      convertTopolTemplate({
        id: 7,
        name: "N",
        screenshot_url: "https://example.com/shot.png",
        definition: { tagName: "mj-global-style" },
        html: "<html>",
      } as never),
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

  it("keeps the generic tagName message when a template-shaped envelope has neither json nor definition", () => {
    expect(() =>
      convertTopolTemplate({
        id: 7,
        name: "N",
        screenshot_url: "https://example.com/shot.png",
        html: "<html>",
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
      "No convertible content was found in the Topol design. Check that its mj-container (or mj-body) holds at least one mj-section.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("names both container tags when neither is present", () => {
    const { content, report } = convertTopolTemplate({
      tagName: "mj-global-style",
      attributes: {},
      children: [{ tagName: "mj-head", attributes: {}, children: [] }],
    });
    expect(content.blocks).toEqual([]);
    expect(report.entries).toEqual([]);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Topol design. Check that its mj-container (or mj-body) holds at least one mj-section.",
    ]);
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
  it("converts mj-body sections like mj-container sections", () => {
    const containerResult = convertTopolTemplate(make("mj-container"));
    const bodyResult = convertTopolTemplate(make("mj-body"));

    for (const result of [containerResult, bodyResult]) {
      expect(result.content.blocks).toHaveLength(1);
      const section = result.content.blocks[0] as SectionBlock;
      expect(section.type).toBe("section");
      expect(section.children[0]).toHaveLength(1);
      const paragraph = section.children[0][0] as ParagraphBlock;
      expect(paragraph.type).toBe("paragraph");
      expect(paragraph.content).toContain("Hi");
      expect(result.report.entries).toHaveLength(2);
      expect(result.report.entries.map((entry) => entry.status)).toEqual([
        "converted",
        "converted",
      ]);
      expect(result.report.warnings).toEqual([]);
    }

    expect(withoutIds(bodyResult.content.blocks)).toEqual(
      withoutIds(containerResult.content.blocks),
    );
    expect(bodyResult.report.entries).toEqual(containerResult.report.entries);
  });

  it("reads mj-body background-color into template settings", () => {
    const design = make("mj-body");
    design.children[0].attributes = { "background-color": "#abcdef" };

    const { content } = convertTopolTemplate(design);
    expect(content.settings.backgroundColor).toBe("#abcdef");
  });

  it("uses the first container tag in document order", () => {
    const body = make("mj-body").children[0];
    body.attributes = { "background-color": "#abcdef" };
    const container = make("mj-container").children[0];
    container.attributes = { "background-color": "#123456" };

    const firstBody = convertTopolTemplate({
      tagName: "mj-global-style",
      attributes: {},
      children: [body, container],
    });
    const firstContainer = convertTopolTemplate({
      tagName: "mj-global-style",
      attributes: {},
      children: [container, body],
    });
    expect(firstBody.content.settings.backgroundColor).toBe("#abcdef");
    expect(firstContainer.content.settings.backgroundColor).toBe("#123456");
    expect(firstBody.content.blocks).toHaveLength(1);
    expect(firstContainer.content.blocks).toHaveLength(1);
    expect(firstBody.report.entries).toHaveLength(2);
    expect(firstContainer.report.entries).toHaveLength(2);
  });

  it("reads settings from the global style and the container", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#f4f4f4");
    expect(content.settings.textColor).toBe("#222222");
    expect(content.settings.fontFamily).toBe(
      "Ubuntu, Helvetica, Arial, sans-serif",
    );
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

  it("keeps the four equal columns and does not approximate the section", () => {
    const { content, report } = convertTopolTemplate(NEWSLETTER);
    const third = content.blocks[2] as SectionBlock;
    expect(third.columns).toBe("4");
    expect(third.children).toHaveLength(4);
    expect(third.children[3].map((block) => block.type)).toEqual(["social"]);
    expect(
      report.entries.some(
        (entry) =>
          entry.status === "approximated" && entry.sourceTag === "mj-section",
      ),
    ).toBe(false);
  });

  it("imports only the social platforms named in display", () => {
    const { content } = convertTopolTemplate(NEWSLETTER);
    const third = content.blocks[2] as SectionBlock;
    expect(elementIdIssues(content)).toEqual([]);
    const social = third.children[3].find(
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
    // Three sections + 3 + 3 + 2 leaves. Counted by hand from the fixture —
    // never assert `summary.total === entries.length`, which is how `total` is
    // computed and so can never fail. The four equal columns convert; one
    // leaf stays approximated.
    expect(report.summary).toEqual({
      total: 11,
      converted: 10,
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
