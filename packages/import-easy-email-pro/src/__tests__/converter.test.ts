/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ButtonBlock, SectionBlock } from "@templatical/types";
import { convertEasyEmailProTemplate } from "../converter";
import type { EasyEmailProDocument, EasyEmailProPage } from "../types";
import example1 from "./fixtures/example-1.json" with { type: "json" };

const EMPTY_PAGE: EasyEmailProPage = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};

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
    expect(report.warnings).toEqual([
      "No convertible content was found in the Easy Email Pro page. Check that page.children holds at least one standard-section.",
    ]);
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
    const { content } = convertEasyEmailProTemplate({
      type: "page",
      data: {
        variables: [{ name: "primary-color", value: "#8C9A80", type: "color" }],
      },
      attributes: { "background-color": "$var(primary-color)", width: "600px" },
      children: [],
    });
    expect(content.settings.backgroundColor).toBe("#8C9A80");
    expect(content.settings.width).toBe(600);
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
