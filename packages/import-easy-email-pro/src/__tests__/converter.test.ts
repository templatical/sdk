/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  Block,
  ButtonBlock,
  DividerBlock,
  ImageBlock,
  ParagraphBlock,
  SectionBlock,
} from "@templatical/types";
import { convertEasyEmailProTemplate } from "../converter";
import type {
  EasyEmailProDocument,
  EasyEmailProNode,
  EasyEmailProPage,
} from "../types";
import example1 from "./fixtures/example-1.json" with { type: "json" };

const EMPTY_PAGE: EasyEmailProPage = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};

const EMPTY_WARNING =
  "No convertible content was found in the Easy Email Pro page. Check that page.children holds at least one standard-section.";

function pageWithParagraph(
  extra: Partial<EasyEmailProPage> = {},
): EasyEmailProPage {
  return {
    type: "page",
    data: extra.data ?? {},
    attributes: extra.attributes ?? {},
    children: [
      {
        type: "standard-section",
        data: {},
        attributes: {},
        children: [
          {
            type: "standard-column",
            data: {},
            attributes: {},
            children: [
              {
                type: "standard-paragraph",
                data: {},
                attributes: {},
                children: [{ text: "Hi" }],
              },
            ],
          },
        ],
      },
    ],
  };
}

const INVALID_MESSAGE =
  "Invalid Easy Email Pro template: expected a page JSON object (EmailTemplate { subject, content } or the page element).";
const OSS_MESSAGE =
  "Invalid Easy Email Pro template: this looks like open-source Easy Email JSON, not Easy Email Pro (expected standard-* children).";

describe("convertEasyEmailProTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertEasyEmailProTemplate(42 as never)).toThrow(
      INVALID_MESSAGE,
    );
  });

  it("throws the same message for unparseable JSON", () => {
    expect(() => convertEasyEmailProTemplate("{")).toThrow(INVALID_MESSAGE);
  });

  it("throws when type is missing", () => {
    expect(() =>
      convertEasyEmailProTemplate({ children: [] } as never),
    ).toThrow(INVALID_MESSAGE);
  });

  it("throws on an Unlayer-shaped object rather than importing it", () => {
    expect(() =>
      convertEasyEmailProTemplate({ body: { rows: [] } } as never),
    ).toThrow(INVALID_MESSAGE);
  });

  it("throws a dedicated message for OSS Easy Email JSON", () => {
    expect(() =>
      convertEasyEmailProTemplate({
        subject: "Hi",
        content: {
          type: "page",
          children: [{ type: "section", children: [] }],
        },
      } as never),
    ).toThrow(OSS_MESSAGE);
  });

  it("accepts a JSON string of a bare page", () => {
    const { content } = convertEasyEmailProTemplate(JSON.stringify(EMPTY_PAGE));
    expect(content.blocks).toEqual([]);
  });

  it("accepts the EmailTemplate envelope", () => {
    const { content } = convertEasyEmailProTemplate({
      subject: "Welcome",
      content: EMPTY_PAGE,
    });
    expect(content.blocks).toEqual([]);
  });

  it("ignores sibling html and mjml keys on the envelope", () => {
    const { content } = convertEasyEmailProTemplate({
      subject: "Welcome",
      content: EMPTY_PAGE,
      html: "<html></html>",
      mjml: "<mjml></mjml>",
    });
    expect(content.blocks).toEqual([]);
  });

  it("warns when the page has no convertible content", () => {
    const { report } = convertEasyEmailProTemplate(EMPTY_PAGE);
    expect(report.warnings).toEqual([EMPTY_WARNING]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the page declares none", () => {
    const { content } = convertEasyEmailProTemplate(EMPTY_PAGE);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect(content.settings.linkUnderline).toBe(true);
    expect(content.settings.locale).toBe("en");
    expect("preheaderText" in content.settings).toBe(false);
    expect("linkColor" in content.settings).toBe(false);
  });

  it("warns once when subject is non-empty", () => {
    const { report } = convertEasyEmailProTemplate({
      subject: "Welcome to Easy Email Pro",
      content: EMPTY_PAGE,
    });
    expect(report.warnings).toContain(
      'Document subject "Welcome to Easy Email Pro" has no TemplateSettings field and was dropped.',
    );
  });
});

describe("settings and walk", () => {
  it("resolves $var on page background-color", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {
        variables: [{ name: "primary-color", value: "#8C9A80", type: "color" }],
      },
      attributes: { "background-color": "$var(primary-color)", width: "600px" },
      children: [],
    });
    expect(content.settings.backgroundColor).toBe("#8C9A80");
    expect(content.settings.width).toBe(600);
    expect(report.warnings).toEqual([
      "Resolved 1 $var() values, 0 left unresolved.",
      EMPTY_WARNING,
    ]);
  });

  it("warns once with resolved and unresolved $var counts", () => {
    const { report } = convertEasyEmailProTemplate(
      pageWithParagraph({
        data: {
          variables: [
            { name: "primary-color", value: "#8C9A80", type: "color" },
          ],
        },
        attributes: {
          "background-color": "$var(primary-color)",
          "link-color": "$var(missing)",
        },
      }),
    );
    expect(report.warnings).toEqual([
      "Resolved 1 $var() values, 1 left unresolved.",
    ]);
  });

  it("does not warn about $var when none were substituted", () => {
    const { report } = convertEasyEmailProTemplate(pageWithParagraph());
    expect(report.warnings.filter((w) => w.includes("$var"))).toEqual([]);
  });

  it("bakes blockAttributes paragraph color into content HTML", () => {
    const { content } = convertEasyEmailProTemplate(
      pageWithParagraph({
        data: {
          blockAttributes: { "standard-paragraph": { color: "#FFFFFF" } },
        },
      }),
    );
    const section = content.blocks[0] as SectionBlock;
    const para = section.children[0][0] as ParagraphBlock;
    expect(para.content).toBe('<p style="color: #FFFFFF">Hi</p>');
  });

  it("does not swap content-background-color onto settings.backgroundColor", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {
        "background-color": "#f5f5f5",
        "content-background-color": "#ffffff",
      },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {},
          children: [
            {
              type: "standard-column",
              data: {},
              attributes: {},
              children: [
                {
                  type: "standard-paragraph",
                  data: {},
                  attributes: {},
                  children: [{ text: "Hi" }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(content.settings.backgroundColor).toBe("#f5f5f5");
    expect(content.blocks[0].type).toBe("section");
    expect(
      (content.blocks[0] as { styles: { backgroundColor?: string } }).styles
        .backgroundColor,
    ).toBe("#ffffff");
  });

  it("reads globalAttributes font-family", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: { globalAttributes: { "font-family": "Georgia, serif" } },
      attributes: {},
      children: [],
    });
    expect(content.settings.fontFamily).toBe("Georgia, serif");
  });

  it("warns once when headStyles is a non-empty array", () => {
    const { report } = convertEasyEmailProTemplate({
      type: "page",
      data: { headStyles: [{ content: ".x { color: red; }" }] },
      attributes: {},
      children: [],
    });
    expect(report.warnings).toContain(
      "Dropped headStyles — Templatical templates have no document-level head-style table.",
    );
    expect(
      report.warnings.filter((w) => w.includes("headStyles")),
    ).toHaveLength(1);
  });

  it("warns once when headStyles is a non-empty object", () => {
    const { report } = convertEasyEmailProTemplate({
      type: "page",
      data: { headStyles: { content: "a { color: blue; }" } },
      attributes: {},
      children: [],
    });
    expect(
      report.warnings.filter((w) => w.includes("headStyles")),
    ).toHaveLength(1);
  });

  it("skips empty logic and approximates logic with children", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {},
          logic: { condition: "user.vip" },
          children: [
            {
              type: "standard-column",
              data: {},
              attributes: {},
              children: [
                {
                  type: "standard-paragraph",
                  data: {},
                  attributes: {},
                  children: [{ text: "VIP" }],
                },
              ],
            },
          ],
        },
        {
          type: "standard-section",
          data: {},
          attributes: {},
          logic: { iteration: { dataSource: "products" } },
          children: [],
        },
      ],
    });
    expect(content.blocks).toHaveLength(1);
    expect(report.entries.some((e) => e.status === "skipped")).toBe(true);
    expect(
      report.entries.some(
        (e) =>
          e.status === "approximated" && String(e.note).includes("user.vip"),
      ),
    ).toBe(true);
  });

  it("walks a widget's children with its own input table", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {
        variables: [{ name: "primary-color", value: "#8C9A80", type: "color" }],
      },
      attributes: {},
      children: [
        {
          type: "section_widget",
          data: { input: { "primary-color": "#d3943c" } },
          attributes: {},
          children: [
            {
              type: "standard-section",
              data: {},
              attributes: {},
              children: [
                {
                  type: "standard-column",
                  data: {},
                  attributes: {},
                  children: [
                    {
                      type: "standard-button",
                      data: { content: "Button" },
                      attributes: { "background-color": "$var(primary-color)" },
                      children: [{ text: "Click" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const section = content.blocks[0] as {
      children: Array<Array<{ backgroundColor?: string; text?: string }>>;
    };
    expect(section.children[0][0].text).toBe("Click");
    expect(section.children[0][0].backgroundColor).toBe("#d3943c");
  });

  it("warns once when any node carried mobileAttributes", () => {
    const { report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {},
          mobileAttributes: { "padding-top": "10px" },
          children: [
            {
              type: "standard-column",
              data: {},
              attributes: {},
              children: [
                {
                  type: "standard-paragraph",
                  data: {},
                  attributes: {},
                  children: [{ text: "Hi" }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(report.warnings).toContain(
      "mobileAttributes were dropped; Templatical has no per-viewport padding.",
    );
    expect(
      report.warnings.filter((w) => w.includes("mobileAttributes")),
    ).toHaveLength(1);
  });

  it("wraps a page-level standard-text in a one-column section", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-text",
          data: {},
          attributes: {},
          children: [{ text: "Loose text" }],
        },
      ],
    });
    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");
    expect(section.children[0].map((b) => b.type)).toEqual(["paragraph"]);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "Loose text",
    );
    expect(report.summary.htmlFallback).toBe(0);
  });

  it("loads the hand-authored example-1 fixture", () => {
    const { content } = convertEasyEmailProTemplate(
      example1 as EasyEmailProDocument,
    );
    expect(content.blocks.map((b) => b.type)).toEqual(["section"]);
    const section = content.blocks[0] as SectionBlock;
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    const leaves = section.children.flat();
    const filled = leaves.find(
      (b): b is ButtonBlock =>
        b.type === "button" && b.backgroundColor === "#C5900C",
    );
    const outlined = leaves.find(
      (b): b is ButtonBlock =>
        b.type === "button" && b.backgroundColor === "#ffffff",
    );
    expect(filled?.backgroundColor).toBe("#C5900C");
    expect(outlined?.backgroundColor).toBe("#ffffff");
  });
});

function textSection(text: string): EasyEmailProNode {
  return {
    type: "standard-section",
    data: {},
    attributes: {},
    children: [
      {
        type: "standard-column",
        data: {},
        attributes: {},
        children: [
          {
            type: "standard-paragraph",
            data: {},
            attributes: {},
            children: [{ text }],
          },
        ],
      },
    ],
  };
}

function band(
  type: "page-header" | "page-footer",
  content: EasyEmailProNode[],
  extra: Partial<EasyEmailProNode> = {},
): EasyEmailProNode {
  return {
    type,
    data: { content, editable: true },
    attributes: {},
    children: [{ text: "" }],
    ...extra,
  };
}

function paragraphText(block: Block): string {
  const section = block as SectionBlock;
  return (section.children[0][0] as ParagraphBlock).content;
}

describe("page-header and page-footer", () => {
  it("converts their sections in order and paints the band onto them", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band("page-header", [textSection("Header")], {
          attributes: {
            "background-color": "#4a90e2",
            "padding-top": "12px",
            "padding-bottom": "12px",
          },
        }),
        textSection("Body"),
        band("page-footer", [textSection("Footer")]),
      ],
    });
    expect(content.blocks.map((b) => b.type)).toEqual([
      "section",
      "section",
      "section",
    ]);
    expect(content.blocks.map(paragraphText)).toEqual([
      "Header",
      "Body",
      "Footer",
    ]);
    const [header, body, footer] = content.blocks as SectionBlock[];
    expect(header.wrapper).toEqual({
      backgroundColor: "#4a90e2",
      padding: { top: 12, right: 0, bottom: 12, left: 0 },
    });
    expect("wrapper" in body).toBe(false);
    expect(footer.wrapper).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(report.summary).toEqual({
      total: 6,
      converted: 6,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("wraps a bare leaf in the band's content in a section", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band(
          "page-header",
          [
            {
              type: "standard-image",
              data: {},
              attributes: { src: "https://cdn.test/logo.png", alt: "Logo" },
              children: [{ text: "" }],
            },
          ],
          { attributes: { "background-color": "#FFFFFF" } },
        ),
      ],
    });
    const header = content.blocks[0] as SectionBlock;
    expect(header.type).toBe("section");
    expect(header.children[0].map((b) => b.type)).toEqual(["image"]);
    expect((header.children[0][0] as ImageBlock).src).toBe(
      "https://cdn.test/logo.png",
    );
    expect(header.wrapper?.backgroundColor).toBe("#FFFFFF");
    expect(report.entries).toEqual([
      {
        sourceTag: "standard-image",
        templaticalBlockType: "image",
        status: "converted",
      },
    ]);
  });

  it("copies the band onto each of several sections and approximates them", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band("page-footer", [textSection("One"), textSection("Two")], {
          attributes: { "background-color": "#222222" },
        }),
      ],
    });
    expect(content.blocks).toHaveLength(2);
    expect(
      (content.blocks as SectionBlock[]).map((s) => s.wrapper?.backgroundColor),
    ).toEqual(["#222222", "#222222"]);
    const sections = report.entries.filter(
      (e) => e.templaticalBlockType === "section",
    );
    expect(sections).toEqual([
      {
        sourceTag: "standard-section",
        templaticalBlockType: "section",
        status: "approximated",
        note: "page-footer holding 2 sections was applied to each of them — Templatical has no multi-section band.",
      },
      {
        sourceTag: "standard-section",
        templaticalBlockType: "section",
        status: "approximated",
        note: "page-footer holding 2 sections was applied to each of them — Templatical has no multi-section band.",
      },
    ]);
  });

  it("skips an empty band with one entry", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band("page-header", []),
        band("page-footer", [
          { type: "placeholder", data: {}, attributes: {}, children: [] },
        ]),
        textSection("Body"),
      ],
    });
    expect(content.blocks.map(paragraphText)).toEqual(["Body"]);
    expect(report.entries.filter((e) => e.status === "skipped")).toEqual([
      {
        sourceTag: "page-header",
        templaticalBlockType: null,
        status: "skipped",
        note: "An empty page-header produces nothing.",
      },
      {
        sourceTag: "page-footer",
        templaticalBlockType: null,
        status: "skipped",
        note: "An empty page-footer produces nothing.",
      },
    ]);
  });

  it("converts a band's content under logic rather than skipping it", () => {
    const { content, report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band("page-header", [textSection("VIP header")], {
          logic: { condition: "user.vip" },
        }),
      ],
    });
    expect(content.blocks.map(paragraphText)).toEqual(["VIP header"]);
    expect(report.entries.map((e) => [e.status, e.note])).toEqual([
      ["approximated", "logic user.vip"],
      ["approximated", "logic user.vip"],
    ]);
  });

  it("warns about mobileAttributes carried inside a band", () => {
    const section = textSection("Header");
    section.mobileAttributes = { "padding-top": "4px" };
    const { report } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [band("page-header", [section])],
    });
    expect(report.warnings).toEqual([
      "mobileAttributes were dropped; Templatical has no per-viewport padding.",
    ]);
  });
});

function dividerSection(...widths: string[]): EasyEmailProNode {
  return {
    type: "standard-section",
    data: {},
    attributes: {},
    children: [
      {
        type: "standard-column",
        data: {},
        attributes: {},
        children: widths.map((width) => ({
          type: "standard-divider",
          data: {},
          attributes: { width },
          children: [],
        })),
      },
    ],
  };
}

function dividerWidths(block: Block): Array<DividerBlock["width"]> {
  return ((block as SectionBlock).children[0] as DividerBlock[]).map(
    (divider) => divider.width,
  );
}

describe("divider width against the page", () => {
  it("measures a column against the page width", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: { width: "500px" },
      children: [dividerSection("500px", "499px", "40%")],
    });
    expect(dividerWidths(content.blocks[0])).toEqual(["full", 499, "40%"]);
  });

  it("keeps the page width inside a widget", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        {
          type: "section_widget",
          data: { input: {} },
          attributes: {},
          children: [dividerSection("600px", "599px")],
        },
      ],
    });
    expect(dividerWidths(content.blocks[0])).toEqual(["full", 599]);
  });

  it("narrows the width inside a band's padding", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: [
        band("page-footer", [dividerSection("520px", "519px")], {
          attributes: { "padding-left": "40px", "padding-right": "40px" },
        }),
      ],
    });
    expect(dividerWidths(content.blocks[0])).toEqual(["full", 519]);
  });

  it("measures a page-level divider against the page width", () => {
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {},
      attributes: {},
      children: ["600px", "599px"].map((width) => ({
        type: "standard-divider",
        data: {},
        attributes: { width },
        children: [],
      })),
    });
    expect(content.blocks.map(dividerWidths)).toEqual([["full"], [599]]);
  });
});

const corpus = "/tmp/easy-email-pro-corpus/template1.json";
describe.skipIf(!existsSync(corpus))("corpus template1", () => {
  it("resolves the page background and does not emit countdown", () => {
    const { content } = convertEasyEmailProTemplate(
      readFileSync(corpus, "utf8"),
    );
    expect(content.settings.backgroundColor).toBe("#8C9A80");
    expect(content.blocks.some((b) => b.type === "countdown")).toBe(false);
    expect(content.blocks.length).toBeGreaterThan(0);
  });
});
