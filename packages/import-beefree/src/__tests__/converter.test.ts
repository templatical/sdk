import { elementIdIssues } from "@templatical/types";
import { describe, it, expect } from "vitest";
import type { Block, DividerBlock, ImageBlock } from "@templatical/types";
import { convertBeeFreeTemplate } from "../converter";
import type { BeeFreeeRow, BeeFreeTemplate } from "../types";
import fixture from "./fixtures/example-1.json";

describe("convertBeeFreeTemplate", () => {
  it("throws for invalid input", () => {
    expect(() => convertBeeFreeTemplate({} as BeeFreeTemplate)).toThrow(
      "Invalid BeeFree template",
    );

    expect(() =>
      convertBeeFreeTemplate({ page: {} } as BeeFreeTemplate),
    ).toThrow("missing page.rows");
  });

  it("converts minimal template", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [],
        body: {
          content: {
            style: {
              width: "600px",
              "background-color": "#ffffff",
              "font-family": "Arial, sans-serif",
            },
          },
        },
      },
    };

    const { content, report } = convertBeeFreeTemplate(template);

    expect(content.blocks).toHaveLength(0);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(report.summary.total).toBe(0);
  });

  // BeeFree exports keep the body width in `computedStyle.messageWidth` and
  // usually carry no `style.width`, which would leave every import at 600px.
  it("reads the body width from computedStyle.messageWidth", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { computedStyle: { messageWidth: "480px" } } },
      },
    });

    expect(content.settings.width).toBe(480);
  });

  it("prefers messageWidth to style.width, and falls back to style.width", () => {
    const both = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: {
          content: {
            style: { width: "700px" },
            computedStyle: { messageWidth: "480px" },
          },
        },
      },
    });
    const styleOnly = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { style: { width: "700px" } } },
      },
    });

    expect(both.content.settings.width).toBe(480);
    expect(styleOnly.content.settings.width).toBe(700);
  });

  it("maps the body's text color to settings.textColor", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { style: { color: "#333333" } } },
      },
    });

    expect(content.settings.textColor).toBe("#333333");
  });

  it("falls back to #1a1a1a when the body sets no usable text color", () => {
    const none = convertBeeFreeTemplate({ page: { rows: [] } });
    const keyword = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { style: { color: "inherit" } } },
      },
    });

    expect(none.content.settings.textColor).toBe("#1a1a1a");
    expect(keyword.content.settings.textColor).toBe("#1a1a1a");
  });

  // Every text block without a color of its own inherits `textColor`, so a
  // paragraph needs a color span exactly when it differs from the body's.
  it("keeps a paragraph's color only where it differs from the body's", () => {
    const paragraph = (color: string) => ({
      type: "mailup-bee-newsletter-modules-paragraph",
      descriptor: { paragraph: { html: "<p>Hi</p>", style: { color } } },
    });
    const { content } = convertBeeFreeTemplate({
      page: {
        body: { content: { style: { color: "#333333" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [paragraph("#1a1a1a"), paragraph("#333333")],
              },
            ],
          },
          {
            columns: [
              { "grid-columns": 6, modules: [paragraph("#1a1a1a")] },
              { "grid-columns": 6, modules: [paragraph("#333333")] },
            ],
          },
        ],
      },
    });

    const contents = (blocks: Block[]): string[] =>
      blocks.flatMap((b) =>
        b.type === "section"
          ? b.children.flatMap((col) => contents(col))
          : b.type === "paragraph"
            ? [b.content]
            : [],
      );
    expect(contents(content.blocks)).toEqual([
      '<p><span style="color: #1a1a1a">Hi</span></p>',
      "<p>Hi</p>",
      '<p><span style="color: #1a1a1a">Hi</span></p>',
      "<p>Hi</p>",
    ]);
  });

  it("maps the body's link color to settings.linkColor", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { computedStyle: { linkColor: "#0068A5" } } },
      },
    });

    expect(content.settings.linkColor).toBe("#0068a5");
  });

  it("leaves settings.linkColor unset when the body has no link color", () => {
    const { content } = convertBeeFreeTemplate({ page: { rows: [] } });

    expect("linkColor" in content.settings).toBe(false);
  });

  // BeeFree underlines per link, in the link's own markup, and has no
  // template-wide switch; links default to underlined, as in a browser.
  it("underlines links", () => {
    const { content } = convertBeeFreeTemplate({ page: { rows: [] } });

    expect(content.settings.linkUnderline).toBe(true);
  });

  it("falls back to Arial when the body font is a CSS-wide keyword", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [],
        body: { content: { style: { "font-family": "inherit" } } },
      },
    });

    expect(content.settings.fontFamily).toBe("Arial");
  });

  it("converts a single-column text row", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: {
                      style: {
                        "padding-top": "10px",
                        "padding-right": "20px",
                        "padding-bottom": "10px",
                        "padding-left": "20px",
                      },
                      text: {
                        style: {
                          color: "#555555",
                          "font-size": "14px",
                          "text-align": "center",
                        },
                        html: "<p>Hello World</p>",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content, report } = convertBeeFreeTemplate(template);

    expect(content.blocks).toHaveLength(1);
    const block = content.blocks[0];
    expect(block.type).toBe("paragraph");
    if (block.type === "paragraph") {
      expect(block.content).toContain("Hello World");
      expect(block.content).toContain("color: #555555");
      expect(block.content).toContain("font-size: 14px");
      expect(block.content).toContain("text-align: center");
      expect(block.content).not.toContain("<div");
      expect(block.styles.padding).toEqual({
        top: 10,
        right: 20,
        bottom: 10,
        left: 20,
      });
    }

    expect(report.summary.converted).toBe(1);
  });

  it("preserves a single-column row's background color by wrapping it in a section", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            content: { style: { "background-color": "#ff0000" } },
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: {
                      text: { html: "<p>Colored band</p>" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);

    // A single-column row used to return bare modules, dropping the row's
    // background. It must now wrap them in a one-column section that carries
    // the background, mirroring the multi-column path and the Unlayer importer.
    expect(content.blocks).toHaveLength(1);
    const block = content.blocks[0];
    expect(block.type).toBe("section");
    if (block.type === "section") {
      expect(block.columns).toBe("1");
      expect(block.styles.backgroundColor).toBe("#ff0000");
      expect(block.children[0][0].type).toBe("paragraph");
      const child = block.children[0][0];
      if (child.type === "paragraph") {
        expect(child.content).toContain("Colored band");
      }
    }
  });

  it("does not wrap a single-column row without a background", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: { text: { html: "<p>Plain</p>" } },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);

    // No background → no needless section wrapper; the bare paragraph stays.
    expect(content.blocks).toHaveLength(1);
    expect(content.blocks[0].type).toBe("paragraph");
  });

  it("converts a two-column row into a section", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 6,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-image",
                    descriptor: {
                      image: {
                        src: "https://example.com/img.jpg",
                        alt: "Test",
                      },
                    },
                  },
                ],
              },
              {
                "grid-columns": 6,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: {
                      text: {
                        html: "<p>Text</p>",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("2");
      expect(section.children).toHaveLength(2);
      expect(section.children[0]).toHaveLength(1);
      expect(section.children[1]).toHaveLength(1);
      expect(section.children[0][0].type).toBe("image");
      expect(section.children[1][0].type).toBe("paragraph");
    }
  });

  it("maps asymmetric columns (8+4 → 2-1)", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              { "grid-columns": 8, modules: [] },
              { "grid-columns": 4, modules: [] },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);
    const section = content.blocks[0];
    if (section.type === "section") {
      expect(section.columns).toBe("2-1");
    }
  });

  it("maps asymmetric columns (4+8 → 1-2)", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              { "grid-columns": 4, modules: [] },
              { "grid-columns": 8, modules: [] },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);
    const section = content.blocks[0];
    if (section.type === "section") {
      expect(section.columns).toBe("1-2");
    }
  });

  it("keeps four equal grid columns", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 3,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-spacer",
                    descriptor: {
                      spacer: {
                        style: { height: "20px" },
                      },
                    },
                  },
                ],
              },
              { "grid-columns": 3, modules: [] },
              { "grid-columns": 3, modules: [] },
              { "grid-columns": 3, modules: [] },
            ],
          },
        ],
      },
    };

    const { content, report } = convertBeeFreeTemplate(template);
    const section = content.blocks[0];

    expect(section?.type).toBe("section");
    if (section?.type === "section") {
      expect(section.columns).toBe("4");
      expect(section.children).toHaveLength(4);
      expect(section.children[0][0]?.type).toBe("spacer");
    }
    expect(report.warnings.some((w) => w.includes("flattened"))).toBe(false);
  });

  it("converts button module", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-button",
                    descriptor: {
                      button: {
                        label: "Click Me",
                        href: "https://example.com",
                        style: {
                          "background-color": "#ff0000",
                          color: "#ffffff",
                          "border-radius": "8px",
                          "font-size": "18px",
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);
    const block = content.blocks[0];
    expect(block.type).toBe("button");
    if (block.type === "button") {
      expect(block.text).toBe("Click Me");
      expect(block.url).toBe("https://example.com");
      expect(block.backgroundColor).toBe("#ff0000");
      expect(block.textColor).toBe("#ffffff");
      expect(block.borderRadius).toBe(8);
      expect(block.fontSize).toBe(18);
    }
  });

  it.each([
    [
      {
        "padding-top": "0px",
        "padding-right": "0px",
        "padding-bottom": "0px",
        "padding-left": "0px",
      },
      { top: 0, right: 0, bottom: 0, left: 0 },
      "regular",
    ],
    [
      {
        "padding-top": "1px",
        "padding-right": "1px",
        "padding-bottom": "1px",
        "padding-left": "1px",
      },
      { top: 1, right: 1, bottom: 1, left: 1 },
      "regular",
    ],
    [
      { "padding-top": "0px", "padding-bottom": "0px", "line-height": "200%" },
      { top: 6, right: 24, bottom: 6, left: 24 },
      "regular",
    ],
    [
      { "font-weight": "400" },
      { top: 12, right: 24, bottom: 12, left: 24 },
      "regular",
    ],
    [{}, { top: 12, right: 24, bottom: 12, left: 24 }, "regular"],
  ] as const)(
    "converts issue 1151 button style %j",
    (style, padding, weight) => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  modules: [
                    {
                      type: "mailup-bee-newsletter-modules-button",
                      descriptor: {
                        button: { href: "#", label: "<p>OK</p>", style },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      const block = content.blocks.flatMap((item) =>
        item.type === "section" ? item.children.flat() : [item],
      )[0];
      expect(block.type).toBe("button");
      if (block.type !== "button") throw new Error("expected a button block");
      expect(block.buttonPadding).toEqual(padding);
      expect(block.fontWeight).toBe(weight);
    },
  );

  it("converts divider module", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-divider",
                    descriptor: {
                      divider: {
                        style: {
                          "border-top": "2px dashed #cccccc",
                          width: "80%",
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);
    const block = content.blocks[0];
    expect(block.type).toBe("divider");
    if (block.type === "divider") {
      expect(block.thickness).toBe(2);
      expect(block.lineStyle).toBe("dashed");
      expect(block.color).toBe("#cccccc");
      expect(block.width).toBe("80%");
    }
  });

  describe("px divider widths against the column", () => {
    function divider(width: string) {
      return {
        type: "mailup-bee-newsletter-modules-divider",
        descriptor: {
          divider: { style: { "border-top": "1px solid #cccccc", width } },
          style: { "padding-left": "10px", "padding-right": "10px" },
        },
      };
    }

    function widthsOf(blocks: Block[]): Array<DividerBlock["width"]> {
      return blocks.flatMap((b) =>
        b.type === "section"
          ? b.children.flatMap((col) => widthsOf(col))
          : b.type === "divider"
            ? [b.width]
            : [],
      );
    }

    it("reads a px width that fills a single-column row as full", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  modules: [divider("580px"), divider("300px")],
                },
              ],
            },
          ],
        },
      });
      expect(widthsOf(content.blocks)).toEqual(["full", 300]);
    });

    // An 8+4 row is a 2-1 section: 400px and 200px columns at 600px, so the
    // narrow column leaves 180px between its dividers' padding.
    it("measures each column of a multi-column row separately", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                { "grid-columns": 8, modules: [divider("180px")] },
                {
                  "grid-columns": 4,
                  modules: [divider("180px"), divider("179px")],
                },
              ],
            },
          ],
        },
      });
      const section = content.blocks[0];
      expect(section.type === "section" && section.columns).toBe("2-1");
      expect(widthsOf(content.blocks)).toEqual([180, "full", 179]);
    });

    // 640 / 3 is 213.33; the renderer hands each column 213px, so a 193px
    // divider between 10px of padding already spans it.
    it("floors a column's width as the renderer does", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "640px" } } },
          rows: [
            {
              columns: [
                { "grid-columns": 4, modules: [divider("193px")] },
                { "grid-columns": 4, modules: [] },
                { "grid-columns": 4, modules: [] },
              ],
            },
          ],
        },
      });
      expect(widthsOf(content.blocks)).toEqual(["full"]);
    });

    // A 400px template with 10px of divider padding leaves 380px; measured
    // against a 600px default the same divider stays a 380px line.
    it("measures against the messageWidth the template states", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { computedStyle: { messageWidth: "400px" } } },
          rows: [
            {
              columns: [{ "grid-columns": 12, modules: [divider("380px")] }],
            },
          ],
        },
      });
      expect(content.settings.width).toBe(400);
      expect(widthsOf(content.blocks)).toEqual(["full"]);
    });

    it("measures against the template width the import writes", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "700px" } } },
          rows: [
            {
              columns: [{ "grid-columns": 12, modules: [divider("600px")] }],
            },
          ],
        },
      });
      expect(content.settings.width).toBe(700);
      expect(widthsOf(content.blocks)).toEqual([600]);
    });

    // A quarter of 600 is 150, and the divider's 10px sides leave 130.
    it("measures a four-column divider against its quarter column", () => {
      const row = (width: string) =>
        convertBeeFreeTemplate({
          page: {
            body: { content: { style: { width: "600px" } } },
            rows: [
              {
                columns: [
                  { "grid-columns": 3, modules: [divider(width)] },
                  { "grid-columns": 3, modules: [] },
                  { "grid-columns": 3, modules: [] },
                  { "grid-columns": 3, modules: [] },
                ],
              },
            ],
          },
        });
      const filled = row("130px");
      const narrow = row("129px");
      const section = filled.content.blocks[0];
      expect(section.type === "section" && section.columns).toBe("4");
      expect(widthsOf(filled.content.blocks)).toEqual(["full"]);
      expect(widthsOf(narrow.content.blocks)).toEqual([129]);
    });

    it("measures a five-column row's divider against the body width", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [1, 2, 3, 4, 5].map(() => ({
                "grid-columns": 3,
                modules: [divider("130px")],
              })),
            },
          ],
        },
      });
      expect(widthsOf(content.blocks)).toEqual([130, 130, 130, 130, 130]);
    });
  });

  it("converts unknown module to html fallback", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-unknown-widget",
                    descriptor: {},
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content, report } = convertBeeFreeTemplate(template);

    expect(content.blocks).toHaveLength(1);
    expect(content.blocks[0].type).toBe("html");
    expect(report.summary.htmlFallback).toBe(1);
    expect(report.entries[0].status).toBe("html-fallback");
  });

  it("warns about locked rows", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            locked: true,
            columns: [{ "grid-columns": 12, modules: [] }],
          },
        ],
      },
    };

    const { report } = convertBeeFreeTemplate(template);
    expect(report.warnings.some((w) => w.includes("locked"))).toBe(true);
  });

  // The export's `image.width` × `image.height` are the files (254 × 59 and
  // 1920 × 466); BeeFree shows them at 172.5px left-aligned and across the
  // 600px column.
  it("imports the real fixture's images at the size BeeFree shows them", () => {
    const { content } = convertBeeFreeTemplate(fixture as BeeFreeTemplate);
    const images = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "image")
      .map((b) =>
        b.type === "image"
          ? {
              file: b.src.split("/").pop(),
              width: b.width,
              height: b.height,
              align: b.align,
              natural: [b.naturalWidth, b.naturalHeight],
            }
          : null,
      );
    expect(images).toEqual([
      {
        file: "logoipsum.png",
        width: 173,
        height: undefined,
        align: "left",
        natural: [254, 59],
      },
      {
        file: "hero_white_classic.jpg",
        width: "full",
        height: undefined,
        align: "center",
        natural: [1920, 466],
      },
    ]);
  });

  it("converts real BeeFree fixture", () => {
    const { content, report } = convertBeeFreeTemplate(
      fixture as BeeFreeTemplate,
    );

    expect(elementIdIssues(content)).toEqual([]);
    // The fixture has multiple rows with images, text, buttons, social icons, spacers, dividers
    expect(content.blocks.length).toBeGreaterThan(0);
    expect(content.settings.width).toBe(600);
    expect(content.settings.linkColor).toBe("#0068a5");
    expect(content.settings.linkUnderline).toBe(true);
    expect(content.settings.textColor).toBe("#000000");

    // All modules should be processed
    expect(report.summary.total).toBeGreaterThan(5);
    expect(report.summary.skipped).toBe(0);

    // Verify block types are present. Collect recursively because rows with a
    // background are now wrapped in a one-column section, so a paragraph may be
    // nested inside a section rather than sitting at the top level.
    const collectTypes = (blocks: typeof content.blocks): string[] =>
      blocks.flatMap((b) =>
        b.type === "section"
          ? [b.type, ...b.children.flatMap((col) => collectTypes(col))]
          : [b.type],
      );
    const types = collectTypes(content.blocks);
    expect(types).toContain("image");
    expect(types).toContain("paragraph");

    // Report should be complete
    expect(report.summary.total).toBe(
      report.summary.converted +
        report.summary.approximated +
        report.summary.htmlFallback +
        report.summary.skipped,
    );
  });

  it("skips empty rows", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            empty: true,
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: {
                      text: { html: "<p>skip me</p>" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);
    expect(content.blocks).toHaveLength(0);
  });

  it("resolves 2-column equal-width row to layout '2'", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 6,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-spacer",
                    descriptor: { spacer: { style: { height: "10px" } } },
                  },
                ],
              },
              {
                "grid-columns": 6,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-spacer",
                    descriptor: { spacer: { style: { height: "10px" } } },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const { content } = convertBeeFreeTemplate(template);

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("2");
    }
  });

  it("warns about synced rows", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            synced: true,
            columns: [{ "grid-columns": 12, modules: [] }],
          },
        ],
      },
    };

    const { report } = convertBeeFreeTemplate(template);
    expect(report.warnings.some((w) => w.includes("synced"))).toBe(true);
  });

  it("does not warn about web fonts the template never uses", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [],
        body: {
          content: { style: { "font-family": "Arial, sans-serif" } },
          webFonts: [
            { name: "Montserrat" },
            { name: "Open Sans" },
            { name: "Roboto" },
          ],
        },
      },
    };

    const { customFonts, report } = convertBeeFreeTemplate(template);

    expect(customFonts).toEqual([]);
    expect(report.warnings.some((warning) => /font/i.test(warning))).toBe(
      false,
    );
  });

  it("returns custom fonts that have a URL and skips system stacks", () => {
    const montserrat =
      "'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif";
    const template: BeeFreeTemplate = {
      page: {
        rows: [],
        body: {
          content: { style: { "font-family": montserrat } },
          webFonts: [
            {
              name: "Label",
              fontFamily: montserrat,
              url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap",
            },
            {
              name: "Montserrat",
              fontFamily: "Montserrat, sans-serif",
              url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap",
            },
            {
              name: "inherit",
              fontFamily: "inherit",
              url: "https://fonts.googleapis.com/css2?family=Inherit",
            },
            {
              name: "Arial",
              fontFamily: "Arial, Helvetica Neue, Helvetica, sans-serif",
              url: "https://example.com/arial.css",
            },
            {
              name: "Open Sans",
              url: "https://fonts.googleapis.com/css2?family=Open+Sans",
            },
            { name: "Roboto", fontFamily: "Roboto, sans-serif", url: "  " },
          ],
        },
      },
    };

    const { customFonts, report } = convertBeeFreeTemplate(template);

    expect(customFonts).toEqual([
      {
        name: "Montserrat",
        url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap",
      },
      {
        name: "Open Sans",
        url: "https://fonts.googleapis.com/css2?family=Open+Sans",
      },
    ]);
    expect(report.warnings.some((warning) => /font/i.test(warning))).toBe(
      false,
    );
  });

  it("does not warn when the only fonts are system stacks", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-paragraph",
                    descriptor: {
                      paragraph: {
                        html: "<p>Hi</p>",
                        style: {
                          "font-family":
                            "'Helvetica Neue', Helvetica, Arial, sans-serif",
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
        body: {
          content: {
            style: { "font-family": "Arial, Helvetica, sans-serif" },
          },
          webFonts: [
            {
              name: "Arial",
              fontFamily: "Arial, Helvetica Neue, Helvetica, sans-serif",
            },
            {
              name: "Helvetica",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            },
            {
              name: "Georgia",
              fontFamily: "Georgia, Times, 'Times New Roman', serif",
            },
          ],
        },
      },
    };

    const { customFonts, report } = convertBeeFreeTemplate(template);

    expect(customFonts).toEqual([]);
    expect(report.warnings.some((warning) => /font/i.test(warning))).toBe(
      false,
    );
  });

  it("warns when a used font has no URL and is not a system stack", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-paragraph",
                    descriptor: {
                      paragraph: {
                        html: "<p style=\"font-family: 'Open Sans', Arial\">Hi</p>",
                        style: { "font-family": "inherit" },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
        body: {
          content: {
            style: { "font-family": "'Montserrat', sans-serif" },
          },
          webFonts: [
            { name: "Montserrat", fontFamily: "'Montserrat', sans-serif" },
            { name: "Open Sans" },
            { name: "Arial", fontFamily: "Arial, sans-serif" },
          ],
        },
      },
    };

    const { customFonts, report } = convertBeeFreeTemplate(template);

    expect(customFonts).toEqual([]);
    expect(report.warnings).toEqual([
      'Font "Montserrat" is used but BeeFree provides no URL for it.',
      'Font "Open Sans" is used but BeeFree provides no URL for it.',
    ]);
  });

  describe("row background images", () => {
    function convertRow(
      styles: {
        content?: Record<string, string>;
        container?: Record<string, string>;
      },
      columns = 1,
    ) {
      const template = {
        page: {
          rows: [
            {
              ...(styles.content ? { content: { style: styles.content } } : {}),
              ...(styles.container
                ? { container: { style: styles.container } }
                : {}),
              columns: Array.from({ length: columns }, () => ({
                "grid-columns": 12 / columns,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: { text: { html: "<p>Copy</p>" } },
                  },
                ],
              })),
            },
          ],
        },
      } as BeeFreeTemplate;
      const { content, report } = convertBeeFreeTemplate(template);
      return { blocks: content.blocks, warnings: report.warnings };
    }

    const HERO = {
      "background-image": "url('https://cdn.test/hero.jpg')",
      "background-position": "top left",
      "background-repeat": "no-repeat",
    };

    it("wraps a single-column row with a content image in a section that carries it", () => {
      const { blocks, warnings } = convertRow({ content: HERO });
      expect(blocks).toHaveLength(1);
      const section = blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.backgroundImage).toEqual({
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: false,
      });
      expect(section.styles.backgroundColor).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    it("maps a content image on a multi-column row", () => {
      const section = convertRow({ content: HERO }, 2).blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.columns).toBe("2");
      expect(section.backgroundImage?.url).toBe("https://cdn.test/hero.jpg");
    });

    it("puts a band image on a full-width wrapper while the content area is transparent", () => {
      const { blocks, warnings } = convertRow({
        container: {
          "background-image": "url(https://cdn.test/band.jpg)",
          "background-repeat": "repeat",
          "background-color": "#112233",
        },
        content: { "background-color": "transparent" },
      });
      const section = blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.backgroundImage).toBeUndefined();
      expect(section.styles.backgroundColor).toBeUndefined();
      expect(section.wrapper).toEqual({
        backgroundColor: "#112233",
        backgroundImage: {
          url: "https://cdn.test/band.jpg",
          size: "auto",
          position: { x: "left", y: "top" },
          repeat: true,
        },
        fullWidth: true,
      });
      expect(warnings).toEqual([]);
    });

    it("keeps a band image on the wrapper behind a painted content area", () => {
      const { blocks, warnings } = convertRow({
        container: { "background-image": "url(https://cdn.test/band.jpg)" },
        content: { "background-color": "#ffffff" },
      });
      const section = blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.backgroundImage).toBeUndefined();
      expect(section.styles.backgroundColor).toBe("#ffffff");
      expect(section.wrapper).toEqual({
        backgroundImage: {
          url: "https://cdn.test/band.jpg",
          size: "auto",
          position: { x: "left", y: "top" },
          repeat: true,
        },
        fullWidth: true,
      });
      expect(warnings).toEqual([]);
    });

    it("keeps the content image on the section and the band image on the wrapper", () => {
      const { blocks, warnings } = convertRow({
        container: { "background-image": "url(https://cdn.test/band.jpg)" },
        content: HERO,
      });
      const section = blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.backgroundImage?.url).toBe("https://cdn.test/hero.jpg");
      expect(section.wrapper?.backgroundImage?.url).toBe(
        "https://cdn.test/band.jpg",
      );
      expect(section.wrapper?.fullWidth).toBe(true);
      expect(warnings).toEqual([]);
    });

    it("reports a value with no exact keyword in warnings", () => {
      const { warnings } = convertRow({
        content: { ...HERO, "background-size": "100%" },
      });
      expect(warnings).toEqual([
        'Row background-size "100%" has no exact Templatical equivalent; imported as "cover".',
      ]);
    });

    it("leaves a row whose background-image is none as bare modules", () => {
      const { blocks } = convertRow({
        content: {
          "background-image": "none",
          "background-repeat": "no-repeat",
        },
      });
      expect(blocks[0].type).toBe("paragraph");
    });
  });

  // The reproduction from #1070: only the last divider draws a line in BeeFree.
  it("imports dividers that draw no line as spacers", () => {
    const divider = (borderTop: string) => ({
      type: "mailup-bee-newsletter-modules-divider",
      descriptor: {
        divider: { style: { "border-top": borderTop, width: "100%" } },
        style: {
          "padding-top": "15px",
          "padding-right": "0px",
          "padding-bottom": "15px",
          "padding-left": "0px",
        },
      },
    });
    const { content, report } = convertBeeFreeTemplate({
      page: {
        body: { content: { style: { width: "600px" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  divider("0px solid transparent"),
                  divider("0px solid #BBBBBB"),
                  divider("10px solid transparent"),
                  divider("1px solid #BBBBBB"),
                ],
              },
            ],
          },
        ],
      },
    });
    expect(
      content.blocks.map((b) =>
        b.type === "spacer"
          ? `spacer ${b.height}`
          : b.type === "divider"
            ? `divider ${b.thickness} ${b.color}`
            : b.type,
      ),
    ).toEqual(["spacer 30", "spacer 30", "spacer 40", "divider 1 #bbbbbb"]);
    expect(report.entries.map((e) => e.templaticalBlockType)).toEqual([
      "spacer",
      "spacer",
      "spacer",
      "divider",
    ]);
  });

  describe("modules that import nothing", () => {
    const text = {
      type: "mailup-bee-newsletter-modules-text",
      descriptor: { text: { html: "<p>Hi</p>" } },
    };

    it("reports an empty module skipped and leaves its column empty", () => {
      const { content, report } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 6,
                  modules: [
                    {
                      type: "mailup-bee-newsletter-modules-empty",
                      descriptor: {},
                    },
                  ],
                },
                { "grid-columns": 6, modules: [text] },
              ],
            },
          ],
        },
      });
      const section = content.blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.children.map((col) => col.map((b) => b.type))).toEqual([
        [],
        ["paragraph"],
      ]);
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-empty",
        templaticalBlockType: null,
        status: "skipped",
        note: "The module is empty.",
      });
      expect(report.summary).toMatchObject({
        total: 2,
        converted: 1,
        skipped: 1,
      });
    });

    it("skips a divider that draws no line and has no padding", () => {
      const { content, report } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  modules: [
                    text,
                    {
                      type: "mailup-bee-newsletter-modules-divider",
                      descriptor: {
                        divider: {
                          style: { "border-top": "0px solid transparent" },
                        },
                        style: {
                          "padding-top": "0px",
                          "padding-bottom": "0px",
                        },
                      },
                    },
                    text,
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(content.blocks.map((b) => b.type)).toEqual([
        "paragraph",
        "paragraph",
      ]);
      expect(report.entries[1]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-divider",
        templaticalBlockType: null,
        status: "skipped",
        note: "The divider draws no line and takes no space.",
      });
    });

    it("converts an Icons module that holds icons", () => {
      const { content, report } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  modules: [
                    {
                      type: "mailup-bee-newsletter-modules-icons",
                      descriptor: {
                        iconsList: {
                          icons: [
                            {
                              image: "https://example.com/i.png",
                              width: "48px",
                              height: "48px",
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(content.blocks.map((b) => b.type)).toEqual(["image"]);
      expect(report.entries.map((e) => e.status)).toEqual(["converted"]);
    });

    it("skips an Icons module with no icons", () => {
      const { content, report } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  modules: [
                    {
                      type: "mailup-bee-newsletter-modules-icons",
                      descriptor: { iconsList: { icons: [] } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(content.blocks).toEqual([]);
      expect(report.entries).toEqual([
        {
          beeFreeModuleType: "mailup-bee-newsletter-modules-icons",
          templaticalBlockType: null,
          status: "skipped",
          note: "The Icons module has no icons.",
        },
      ]);
    });
  });

  // A column's box has no per-column home on a section. One column folds its
  // padding, background and border onto the section; several columns fold
  // padding into the modules and drop the rest.
  describe("column box", () => {
    const text = (padding: Record<string, string>) => ({
      type: "mailup-bee-newsletter-modules-text",
      descriptor: {
        style: padding,
        text: { html: "<p>Hi</p>" },
      },
    });

    function sectionOf(template: BeeFreeTemplate) {
      const { content, report } = convertBeeFreeTemplate(template);
      const block = content.blocks[0];
      if (block?.type !== "section") {
        throw new Error(`expected a section, got ${block?.type}`);
      }
      return { section: block, report, content };
    }

    it("adds a single column's padding to the section and leaves the module's padding", () => {
      const { section } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  style: {
                    "padding-top": "11px",
                    "padding-right": "22px",
                    "padding-bottom": "33px",
                    "padding-left": "44px",
                  },
                  modules: [
                    text({
                      "padding-top": "1px",
                      "padding-right": "2px",
                      "padding-bottom": "3px",
                      "padding-left": "4px",
                    }),
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(section.columns).toBe("1");
      expect(section.styles.padding).toEqual({
        top: 11,
        right: 22,
        bottom: 33,
        left: 44,
      });
      expect(section.styles.backgroundColor).toBeUndefined();
      expect(section.children[0][0].styles.padding).toEqual({
        top: 1,
        right: 2,
        bottom: 3,
        left: 4,
      });
    });

    it("prefers the column background over the row content background", () => {
      const painted = sectionOf({
        page: {
          rows: [
            {
              content: { style: { "background-color": "#112233" } },
              columns: [
                {
                  "grid-columns": 12,
                  style: { "background-color": "#abcdef" },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      }).section;
      const transparent = sectionOf({
        page: {
          rows: [
            {
              content: { style: { "background-color": "#112233" } },
              columns: [
                {
                  "grid-columns": 12,
                  style: { "background-color": "transparent" },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      }).section;

      expect(painted.styles.backgroundColor).toBe("#abcdef");
      expect(transparent.styles.backgroundColor).toBe("#112233");
    });

    it("maps a single column's border onto the section", () => {
      const { section } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  style: {
                    "border-top": "2px dashed #112233",
                    "border-right": "4px double #123456",
                    "border-bottom": "1px solid #445566",
                    "border-left": "0px solid transparent",
                  },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      });

      expect(section.border).toEqual({
        top: { width: 2, style: "dashed", color: "#112233" },
        right: { width: 4, style: "solid", color: "#123456" },
        bottom: { width: 1, style: "solid", color: "#445566" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
    });

    function multiColumnBox(
      styles: Record<string, string>[],
      rowStyle?: Record<string, string>,
    ) {
      return sectionOf({
        page: {
          rows: [
            {
              ...(rowStyle ? { content: { style: rowStyle } } : {}),
              columns: styles.map((style) => ({
                "grid-columns": 12 / styles.length,
                style,
                modules: [text({})],
              })),
            },
          ],
        },
      });
    }

    it("promotes the issue's two outer column edges", () => {
      const edge = "1px solid #E7EAEC";
      const none = "0px solid transparent";
      const column = (left: string, right: string) => ({
        "grid-columns": 6,
        style: {
          "border-top": none,
          "border-right": right,
          "border-bottom": none,
          "border-left": left,
        },
        modules: [
          {
            type: "mailup-bee-newsletter-modules-text",
            descriptor: { text: { html: "<p>Text</p>" }, style: {} },
          },
        ],
      });
      const { section, report } = sectionOf({
        page: {
          body: { content: { style: { width: "500px" } } },
          rows: [{ columns: [column(edge, none), column(none, edge)] }],
        },
      });

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 0, style: "solid", color: "#000000" },
        right: { width: 1, style: "solid", color: "#e7eaec" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 1, style: "solid", color: "#e7eaec" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("promotes only the first column's left edge", () => {
      const { section, report } = multiColumnBox([
        { "border-left": "2px dashed #112233" },
        {},
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 0, style: "solid", color: "#000000" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 2, style: "dashed", color: "#112233" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("promotes outer edges across three columns", () => {
      const { section, report } = multiColumnBox([
        { "border-left": "1px solid #112233" },
        {},
        { "border-right": "3px dotted #445566" },
      ]);

      expect(section.columns).toBe("3");
      expect(section.border).toEqual({
        top: { width: 0, style: "solid", color: "#000000" },
        right: { width: 3, style: "dotted", color: "#445566" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 1, style: "solid", color: "#112233" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("keeps the drop warning when an inner side is drawn", () => {
      const { section, report } = multiColumnBox([
        {
          "border-left": "1px solid #112233",
          "border-right": "1px solid #445566",
        },
        { "border-right": "1px solid #112233" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toBeUndefined();
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("promotes an identical top border across every column", () => {
      const { section, report } = multiColumnBox([
        { "border-top": "2px dashed #112233" },
        { "border-top": "2px dashed #112233" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 2, style: "dashed", color: "#112233" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("promotes an identical bottom border across every column", () => {
      const { section, report } = multiColumnBox([
        { "border-bottom": "1px dotted #445566" },
        { "border-bottom": "1px dotted #445566" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 0, style: "solid", color: "#000000" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 1, style: "dotted", color: "#445566" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("keeps the drop warning when only one column draws the top", () => {
      const { section, report } = multiColumnBox([
        { "border-top": "1px solid #112233" },
        {},
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toBeUndefined();
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("keeps the drop warning when top border colors differ", () => {
      const { section, report } = multiColumnBox([
        { "border-top": "1px solid #112233" },
        { "border-top": "1px solid #445566" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toBeUndefined();
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("keeps the drop warning when source top border styles differ", () => {
      const { section, report } = multiColumnBox([
        { "border-top": "1px double #112233" },
        { "border-top": "1px solid #112233" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toBeUndefined();
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("keeps the drop warning when a column background paints", () => {
      const { section, report } = multiColumnBox([
        {
          "border-left": "1px solid #112233",
          "background-color": "#eeeeee",
        },
        { "border-right": "1px solid #112233" },
      ]);

      expect(section.columns).toBe("2");
      expect(section.border).toBeUndefined();
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("merges disjoint row and column border sides", () => {
      const { section, report } = multiColumnBox(
        [
          { "border-left": "1px solid #112233" },
          { "border-right": "1px solid #112233" },
        ],
        { "border-top": "2px dashed #445566" },
      );

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 2, style: "dashed", color: "#445566" },
        right: { width: 1, style: "solid", color: "#112233" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 1, style: "solid", color: "#112233" },
      });
      expect(report.warnings).toEqual([]);
    });

    it("keeps the row border and drop warning when sides overlap", () => {
      const { section, report } = multiColumnBox(
        [
          { "border-left": "1px solid #112233" },
          { "border-right": "1px solid #112233" },
        ],
        { "border-left": "2px solid #445566" },
      );

      expect(section.columns).toBe("2");
      expect(section.border).toEqual({
        top: { width: 0, style: "solid", color: "#000000" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 2, style: "solid", color: "#445566" },
      });
      expect(report.warnings).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("ignores a non-px or negative column padding", () => {
      const { section } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  style: {
                    padding: "8px 9px 10px 11px",
                    "padding-top": "99px",
                  },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      });
      const ignored = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 12,
                  style: {
                    "padding-top": "15px",
                    "padding-right": "2em",
                    "padding-bottom": "-5px",
                    "padding-left": "10",
                  },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      }).section;

      // A shorthand wins over the longhands, the same way a module's padding does.
      expect(section.styles.padding).toEqual({
        top: 8,
        right: 9,
        bottom: 10,
        left: 11,
      });
      expect(ignored.styles.padding).toEqual({
        top: 15,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it("folds each column's padding into its modules and drops the column box", () => {
      const { section, report } = sectionOf({
        page: {
          rows: [
            {
              content: { style: { "background-color": "#eeeeee" } },
              columns: [
                {
                  "grid-columns": 6,
                  style: {
                    "background-color": "#ff00aa",
                    "border-top": "3px solid #000000",
                    "padding-top": "10px",
                    "padding-right": "6px",
                    "padding-bottom": "20px",
                    "padding-left": "4px",
                  },
                  modules: [
                    text({
                      "padding-top": "1px",
                      "padding-right": "2px",
                      "padding-bottom": "3px",
                      "padding-left": "4px",
                    }),
                    text({
                      "padding-top": "0px",
                      "padding-right": "0px",
                      "padding-bottom": "0px",
                      "padding-left": "0px",
                    }),
                    text({
                      "padding-top": "5px",
                      "padding-right": "6px",
                      "padding-bottom": "7px",
                      "padding-left": "8px",
                    }),
                  ],
                },
                {
                  "grid-columns": 6,
                  style: {
                    "padding-top": "9px",
                    "padding-right": "3px",
                    "padding-bottom": "0px",
                    "padding-left": "1px",
                  },
                  modules: [
                    text({
                      "padding-top": "2px",
                      "padding-right": "2px",
                      "padding-bottom": "2px",
                      "padding-left": "2px",
                    }),
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(section.columns).toBe("2");
      expect(section.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(section.styles.backgroundColor).toBe("#eeeeee");
      expect(section.border).toBeUndefined();
      expect(section.children[0][0].styles.padding).toEqual({
        top: 11,
        right: 8,
        bottom: 3,
        left: 8,
      });
      expect(section.children[0][1].styles.padding).toEqual({
        top: 0,
        right: 6,
        bottom: 0,
        left: 4,
      });
      expect(section.children[0][2].styles.padding).toEqual({
        top: 5,
        right: 12,
        bottom: 27,
        left: 12,
      });
      expect(section.children[1][0].styles.padding).toEqual({
        top: 11,
        right: 5,
        bottom: 2,
        left: 3,
      });
      expect(
        report.warnings.filter((warning) =>
          warning.includes("Column background/border"),
        ),
      ).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });

    it("does not warn when every column background and border paints nothing", () => {
      const { report } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 6,
                  style: {
                    "background-color": "transparent",
                    "border-top": "0px solid transparent",
                    "border-right": "0 solid transparent",
                    "border-bottom": "0px solid transparent",
                    "border-left": "0px solid transparent",
                    "padding-left": "5px",
                    "padding-right": "5px",
                  },
                  modules: [text({})],
                },
                {
                  "grid-columns": 6,
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      });

      expect(
        report.warnings.some((warning) =>
          warning.includes("Column background/border"),
        ),
      ).toBe(false);
    });

    it("treats a fully transparent column background as unset", () => {
      const columnWarning = (warnings: string[]) =>
        warnings.filter((warning) =>
          warning.includes("Column background/border"),
        );

      for (const background of [
        "rgba(0, 0, 0, 0)",
        "hsla(0, 0%, 100%, 0)",
        "#00000000",
      ]) {
        const { report } = sectionOf({
          page: {
            rows: [
              {
                columns: [
                  {
                    "grid-columns": 6,
                    style: { "background-color": background },
                    modules: [text({})],
                  },
                  { "grid-columns": 6, modules: [text({})] },
                ],
              },
            ],
          },
        });
        expect(columnWarning(report.warnings)).toEqual([]);
      }

      const { report: borderReport } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 6,
                  style: { "border-top": "1px solid rgba(0, 0, 0, 0)" },
                  modules: [text({})],
                },
                { "grid-columns": 6, modules: [text({})] },
              ],
            },
          ],
        },
      });
      expect(columnWarning(borderReport.warnings)).toEqual([]);

      const { section } = sectionOf({
        page: {
          rows: [
            {
              content: { style: { "background-color": "#112233" } },
              columns: [
                {
                  "grid-columns": 12,
                  style: { "background-color": "rgba(0, 0, 0, 0)" },
                  modules: [text({})],
                },
              ],
            },
          ],
        },
      });
      expect(section.styles.backgroundColor).toBe("#112233");

      const { report: painted, section: paintedSection } = sectionOf({
        page: {
          rows: [
            {
              columns: [
                {
                  "grid-columns": 6,
                  style: { "background-color": "rgba(0, 0, 0, 0.5)" },
                  modules: [text({})],
                },
                { "grid-columns": 6, modules: [text({})] },
              ],
            },
          ],
        },
      });
      expect(columnWarning(painted.warnings)).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
      expect(paintedSection.styles.backgroundColor).toBeUndefined();
    });

    it("folds a four-column row's padding into each column's modules", () => {
      const { content, report } = convertBeeFreeTemplate({
        page: {
          rows: [
            {
              content: { style: { "background-color": "#eeeeee" } },
              columns: [5, 0, 0, 0].map((top, index) => ({
                "grid-columns": 3,
                style: {
                  "padding-top": `${top}px`,
                  "padding-right": "1px",
                  "padding-bottom": "6px",
                  "padding-left": "2px",
                  ...(index === 0 ? { "background-color": "#ff00aa" } : {}),
                },
                modules: [text({})],
              })),
            },
          ],
        },
      });

      const section = content.blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      expect(section.columns).toBe("4");
      expect(section.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(section.styles.backgroundColor).toBe("#eeeeee");
      expect(section.children).toHaveLength(4);
      expect(
        section.children.map((column) => column[0].styles.padding),
      ).toEqual([
        { top: 5, right: 1, bottom: 6, left: 2 },
        { top: 0, right: 1, bottom: 6, left: 2 },
        { top: 0, right: 1, bottom: 6, left: 2 },
        { top: 0, right: 1, bottom: 6, left: 2 },
      ]);
      expect(
        report.warnings.filter((warning) =>
          warning.includes("Column background/border"),
        ),
      ).toEqual([
        "Column background/border was dropped; a multi-column row has no per-column box.",
      ]);
    });
  });

  // Row chrome that lives outside a single column: the container band, hide
  // flags, mobile stacking, a content width, a non-canonical grid and the
  // row border.
  describe("row settings", () => {
    const text = (html = "<p>Hi</p>") => ({
      type: "mailup-bee-newsletter-modules-text",
      descriptor: { text: { html } },
    });

    function convertRow(row: BeeFreeeRow, messageWidth = "600px") {
      return convertBeeFreeTemplate({
        page: {
          body: {
            container: { style: { "background-color": "#f1f2f7" } },
            content: { computedStyle: { messageWidth } },
          },
          rows: [row],
        },
      });
    }

    function sectionOf(row: BeeFreeeRow, messageWidth = "600px") {
      const { content, report } = convertRow(row, messageWidth);
      const block = content.blocks[0];
      if (block?.type !== "section") {
        throw new Error(`expected a section, got ${block?.type}`);
      }
      return { section: block, report, content };
    }

    function ratioNotes(warnings: string[]): string[] {
      return warnings.filter(
        (warning) =>
          warning.includes("Column ratio") || warning.includes("flattened"),
      );
    }

    it("paints the container band across the email and keeps a transparent content box clear", () => {
      const { section, content } = sectionOf({
        container: { style: { "background-color": "#ffffff" } },
        content: { style: { "background-color": "transparent" } },
        columns: [
          {
            "grid-columns": 12,
            style: { "background-color": "transparent" },
            modules: [text()],
          },
        ],
      });

      expect(content.settings.backgroundColor).toBe("#f1f2f7");
      expect(content.settings.width).toBe(600);
      expect(section.styles.backgroundColor).toBeUndefined();
      expect(section.wrapper).toEqual({
        backgroundColor: "#ffffff",
        fullWidth: true,
      });
      expect(section.children[0][0].type).toBe("paragraph");
    });

    it("keeps the content colour on the section and the container colour on the band", () => {
      const { section } = sectionOf({
        container: { style: { "background-color": "#f9f9f9" } },
        content: { style: { "background-color": "#abcdef" } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });

      expect(section.styles.backgroundColor).toBe("#abcdef");
      expect(section.wrapper).toEqual({
        backgroundColor: "#f9f9f9",
        fullWidth: true,
      });
    });

    it("omits the band when it is the same colour as the section fill", () => {
      const { section } = sectionOf({
        container: { style: { "background-color": "#abcdef" } },
        content: { style: { "background-color": "#abcdef" } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });

      expect(section.styles.backgroundColor).toBe("#abcdef");
      expect(section.wrapper).toBeUndefined();
    });

    it("lets a column colour replace the content colour and still keeps a different band", () => {
      const { section } = sectionOf({
        container: { style: { "background-color": "#f9f9f9" } },
        content: { style: { "background-color": "#111111" } },
        columns: [
          {
            "grid-columns": 12,
            style: { "background-color": "#abcdef" },
            modules: [text()],
          },
        ],
      });

      expect(section.styles.backgroundColor).toBe("#abcdef");
      expect(section.wrapper).toEqual({
        backgroundColor: "#f9f9f9",
        fullWidth: true,
      });
    });

    it("does not wrap a row whose container and content paint nothing", () => {
      const { content, report } = convertRow({
        container: { style: { "background-color": "transparent" } },
        content: {
          style: {
            "background-color": "transparent",
            "border-top": "0px solid transparent",
            "border-right": "0px solid transparent",
            "border-bottom": "0px solid transparent",
            "border-left": "0px solid transparent",
            width: "600px",
          },
          computedStyle: {
            hideContentOnMobile: false,
            hideContentOnDesktop: false,
            rowColStackOnMobile: true,
          },
        },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });

      expect(content.blocks[0].type).toBe("paragraph");
      expect(report.warnings).toEqual([]);
    });

    it("maps hide-on-mobile and hide-on-desktop onto section visibility", () => {
      const mobile = sectionOf({
        content: { computedStyle: { hideContentOnMobile: true } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      }).section;
      const desktop = sectionOf({
        content: { computedStyle: { hideContentOnDesktop: "true" } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      }).section;
      const both = sectionOf({
        content: {
          computedStyle: {
            hideContentOnMobile: true,
            hideContentOnDesktop: true,
          },
        },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      }).section;

      expect(mobile.visibility).toEqual({ desktop: true, mobile: false });
      expect(mobile.children[0][0].visibility).toBeUndefined();
      expect(desktop.visibility).toEqual({ desktop: false, mobile: true });
      expect(both.visibility).toEqual({ desktop: false, mobile: false });
    });

    it("sets stackOnMobile false only for a row that opts out", () => {
      const optedOut = sectionOf({
        content: { computedStyle: { rowColStackOnMobile: false } },
        columns: [
          { "grid-columns": 6, modules: [text("<p>L</p>")] },
          { "grid-columns": 6, modules: [text("<p>R</p>")] },
        ],
      });
      const stacking = sectionOf({
        content: { computedStyle: { rowColStackOnMobile: true } },
        columns: [
          { "grid-columns": 6, modules: [text()] },
          { "grid-columns": 6, modules: [text()] },
        ],
      });

      expect(optedOut.section.columns).toBe("2");
      expect(optedOut.section.stackOnMobile).toBe(false);
      expect(optedOut.report.warnings).toEqual([]);
      expect(stacking.section.stackOnMobile).toBeUndefined();
    });

    it("drops a no-stack flag when the row has a single column", () => {
      const { content, report } = convertRow({
        content: { computedStyle: { rowColStackOnMobile: false } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });

      expect(content.blocks[0].type).toBe("paragraph");
      expect(report.warnings).toEqual([
        "rowColStackOnMobile false was dropped; Templatical keeps columns side by side only on a multi-column section.",
      ]);
    });

    it("warns when the row content width differs from the email width and keeps the email width", () => {
      const { section, content, report } = sectionOf({
        content: {
          style: { "background-color": "#abcdef", width: "500px" },
        },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });
      const percent = convertRow({
        content: { style: { width: "100%" } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });
      const same = convertRow({
        content: { style: { width: "600px" } },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });

      expect(content.settings.width).toBe(600);
      expect("width" in section).toBe(false);
      expect(section.styles.backgroundColor).toBe("#abcdef");
      expect(report.warnings).toEqual([
        "Row content width 500px differs from the email width 600px. A section has no width of its own, so the row keeps the email width.",
      ]);
      expect(percent.report.warnings).toEqual([
        'Row content width "100%" differs from the email width 600px. A section has no width of its own, so the row keeps the email width.',
      ]);
      expect(same.report.warnings).toEqual([]);
    });

    it("maps an exact grid silently and names a snapped ratio once", () => {
      const exact = sectionOf({
        columns: [
          { "grid-columns": 8, modules: [text()] },
          { "grid-columns": 4, modules: [text()] },
        ],
      });
      const equal = sectionOf({
        columns: [
          { "grid-columns": 6, modules: [text()] },
          { "grid-columns": 6, modules: [text()] },
        ],
      });
      const thirds = sectionOf({
        columns: [
          { "grid-columns": 4, modules: [text()] },
          { "grid-columns": 4, modules: [text()] },
          { "grid-columns": 4, modules: [text()] },
        ],
      });
      const threeNine = sectionOf({
        columns: [
          { "grid-columns": 3, modules: [text("<p>L</p>")] },
          { "grid-columns": 9, modules: [text("<p>R</p>")] },
        ],
      });
      const nineThree = sectionOf({
        columns: [
          { "grid-columns": 9, modules: [text("<p>L</p>")] },
          { "grid-columns": 3, modules: [text("<p>R</p>")] },
        ],
      });
      const threeSixThree = sectionOf({
        columns: [
          { "grid-columns": 3, modules: [text("<p>L</p>")] },
          { "grid-columns": 6, modules: [text("<p>M</p>")] },
          { "grid-columns": 3, modules: [text("<p>R</p>")] },
        ],
      });
      const sixFourTwo = sectionOf({
        columns: [
          { "grid-columns": 6, modules: [text()] },
          { "grid-columns": 4, modules: [text()] },
          { "grid-columns": 2, modules: [text()] },
        ],
      });
      const fourThreeFive = sectionOf({
        columns: [
          { "grid-columns": 4, modules: [text()] },
          { "grid-columns": 3, modules: [text()] },
          { "grid-columns": 5, modules: [text()] },
        ],
      });
      const fourEqual = sectionOf({
        columns: [1, 2, 3, 4].map((n) => ({
          "grid-columns": 3,
          modules: [text(`<p>${n}</p>`)],
        })),
      });
      const sevenFive = sectionOf({
        columns: [
          { "grid-columns": 7, modules: [text()] },
          { "grid-columns": 5, modules: [text()] },
        ],
      });
      // 7/12 rounds to 583 thousandths: 83 from an even split, 84 from 2/3.
      // 5/12 rounds the same way. A third would narrow the smaller share
      // enough to wrap a one-line footer.
      const fiveSeven = sectionOf({
        columns: [
          { "grid-columns": 5, modules: [text("<p>L</p>")] },
          { "grid-columns": 7, modules: [text("<p>R</p>")] },
        ],
      });
      const unevenThree = sectionOf({
        columns: [
          { "grid-columns": 2, modules: [text()] },
          { "grid-columns": 8, modules: [text()] },
          { "grid-columns": 2, modules: [text()] },
        ],
      });

      expect(exact.section.columns).toBe("2-1");
      expect(ratioNotes(exact.report.warnings)).toEqual([]);
      expect(equal.section.columns).toBe("2");
      expect(ratioNotes(equal.report.warnings)).toEqual([]);
      expect(thirds.section.columns).toBe("3");
      expect(ratioNotes(thirds.report.warnings)).toEqual([]);
      expect(threeNine.section.columns).toBe("1-3");
      expect(threeNine.section.children).toHaveLength(2);
      expect(ratioNotes(threeNine.report.warnings)).toEqual([]);
      expect(nineThree.section.columns).toBe("3-1");
      expect(nineThree.section.children).toHaveLength(2);
      expect(ratioNotes(nineThree.report.warnings)).toEqual([]);
      expect(threeSixThree.section.columns).toBe("1-2-1");
      expect(threeSixThree.section.children).toHaveLength(3);
      expect(ratioNotes(threeSixThree.report.warnings)).toEqual([]);
      expect(fourEqual.section.columns).toBe("4");
      expect(fourEqual.section.children).toHaveLength(4);
      expect(
        fourEqual.section.children.map((column) => column[0].type),
      ).toEqual(["paragraph", "paragraph", "paragraph", "paragraph"]);
      expect(ratioNotes(fourEqual.report.warnings)).toEqual([]);
      expect(sixFourTwo.section.columns).toBe("3");
      expect(sixFourTwo.section.children).toHaveLength(3);
      expect(ratioNotes(sixFourTwo.report.warnings)).toEqual([
        'Column ratio 6-4-2 was mapped to the nearest layout "3".',
      ]);
      expect(fourThreeFive.section.columns).toBe("3");
      expect(ratioNotes(fourThreeFive.report.warnings)).toEqual([
        'Column ratio 4-3-5 was mapped to the nearest layout "3".',
      ]);
      expect(sevenFive.section.columns).toBe("2");
      expect(ratioNotes(sevenFive.report.warnings)).toEqual([
        'Column ratio 7-5 was mapped to the nearest layout "2".',
      ]);
      expect(fiveSeven.section.columns).toBe("2");
      expect(fiveSeven.section.children).toHaveLength(2);
      expect(ratioNotes(fiveSeven.report.warnings)).toEqual([
        'Column ratio 5-7 was mapped to the nearest layout "2".',
      ]);
      expect(unevenThree.section.columns).toBe("1-2-1");
      expect(unevenThree.section.children).toHaveLength(3);
      expect(ratioNotes(unevenThree.report.warnings)).toEqual([
        'Column ratio 2-8-2 was mapped to the nearest layout "1-2-1".',
      ]);
    });

    it("returns inner padding when a snap narrows a column", () => {
      const padding = (left: string, right: string) => ({
        "padding-top": "10px",
        "padding-right": right,
        "padding-bottom": "10px",
        "padding-left": left,
      });
      const paragraph = (align: string, box: Record<string, string>) => ({
        type: "mailup-bee-newsletter-modules-text",
        descriptor: {
          text: { html: `<p style="text-align: ${align}">Hi</p>` },
          style: box,
        },
      });
      const { section } = sectionOf({
        columns: [
          {
            "grid-columns": 7,
            style: padding("40px", "5px"),
            modules: [paragraph("left", padding("10px", "10px"))],
          },
          {
            "grid-columns": 5,
            style: padding("10px", "40px"),
            modules: [paragraph("right", padding("10px", "10px"))],
          },
        ],
      });

      // 7/12 of 600 is 350 and the even column is 300, so the left side is
      // 50px short. Its inner padding is the right side (15px) and that
      // goes to 0; the outer 50px stays. The right column is wider than
      // its 250px source, so its padding is unchanged.
      expect(section.columns).toBe("2");
      expect(section.children[0][0].styles.padding).toEqual({
        top: 20,
        right: 0,
        bottom: 20,
        left: 50,
      });
      expect(section.children[1][0].styles.padding).toEqual({
        top: 20,
        right: 50,
        bottom: 20,
        left: 20,
      });
    });

    // 7/12 of 600 is 350 and the even column is 300, so 50px comes back from
    // the left column's right padding. 60px there becomes 10px. The room
    // before that return is 240px, and after it is 290px.
    describe("widths after inner padding comes back", () => {
      const padding = {
        "padding-top": "0px",
        "padding-right": "60px",
        "padding-bottom": "0px",
        "padding-left": "0px",
      };
      const returned = { top: 0, right: 10, bottom: 0, left: 0 };

      function snapped(
        module: BeeFreeeRow["columns"][number]["modules"][number],
      ) {
        return sectionOf({
          columns: [
            { "grid-columns": 7, modules: [module] },
            { "grid-columns": 5, modules: [text()] },
          ],
        });
      }

      function leftBlock(
        module: BeeFreeeRow["columns"][number]["modules"][number],
      ) {
        return snapped(module).section.children[0][0];
      }

      it("keeps a fixed image at the width the source shows", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-image",
          descriptor: {
            image: {
              src: "https://example.com/photo.png",
              alt: "Photo",
              width: "999px",
              height: "500px",
            },
            computedStyle: { class: "center fixedwidth", width: "240px" },
            style: padding,
          },
        });

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe(240);
        expect(block.naturalWidth).toBe(999);
        expect(block.styles.padding).toEqual(returned);
      });

      it("keeps a source width that only overflowed the column before padding came back", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-image",
          descriptor: {
            image: {
              src: "https://example.com/photo.png",
              alt: "Photo",
              width: "999px",
              height: "500px",
            },
            computedStyle: { class: "center fixedwidth", width: "260px" },
            style: padding,
          },
        });

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe(260);
        expect(block.styles.padding).toEqual(returned);
      });

      it("still returns padding on an image that does not fill the column", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-image",
          descriptor: {
            image: { src: "https://example.com/photo.png", alt: "Photo" },
            computedStyle: { class: "center fixedwidth", width: "200px" },
            style: padding,
          },
        });

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe(200);
        expect(block.styles.padding).toEqual(returned);
      });

      it("stays full when the shown width fills the column after padding comes back", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-image",
          descriptor: {
            image: { src: "https://example.com/photo.png", alt: "Photo" },
            computedStyle: { class: "center autowidth", width: "290px" },
            style: padding,
          },
        });

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe("full");
        expect(block.styles.padding).toEqual(returned);
        expect(block.fluidOnMobile).toBe(false);
      });

      it("converts an image percentage against the room after padding comes back", () => {
        const { section, report } = snapped({
          type: "mailup-bee-newsletter-modules-image",
          descriptor: {
            image: { src: "https://example.com/photo.png", alt: "Photo" },
            computedStyle: { class: "center autowidth", width: "50%" },
            style: padding,
          },
        });
        const block = section.children[0][0];

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe(145);
        expect(block.styles.padding).toEqual(returned);
        expect(report.entries[0]).toMatchObject({
          status: "approximated",
          note: "Image width 50% was converted to 145px.",
        });
      });

      it("keeps a lone icon at the width the source shows", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-icons",
          descriptor: {
            computedStyle: { iconHeight: "240px" },
            iconsList: {
              icons: [
                {
                  image: "https://example.com/icon.png",
                  alt: "Icon",
                  text: "",
                  width: "100px",
                  height: "100px",
                },
              ],
            },
            style: padding,
          },
        });

        expect(block.type).toBe("image");
        if (block.type !== "image") throw new Error("expected an image");
        expect(block.width).toBe(240);
        expect(block.styles.padding).toEqual(returned);
      });

      it("keeps a px divider at the width the source shows", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-divider",
          descriptor: {
            divider: {
              style: { "border-top": "1px solid #cccccc", width: "240px" },
            },
            style: padding,
          },
        });

        expect(block.type).toBe("divider");
        if (block.type !== "divider") throw new Error("expected a divider");
        expect(block.width).toBe(240);
        expect(block.styles.padding).toEqual(returned);
      });

      it("keeps a percentage divider as that share and still returns padding", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-divider",
          descriptor: {
            divider: {
              style: { "border-top": "1px solid #cccccc", width: "50%" },
            },
            style: padding,
          },
        });

        expect(block.type).toBe("divider");
        if (block.type !== "divider") throw new Error("expected a divider");
        expect(block.width).toBe("50%");
        expect(block.styles.padding).toEqual(returned);
      });

      it("keeps a full button as full and still returns padding", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-button",
          descriptor: {
            button: {
              label: "Go",
              href: "https://example.com",
              style: { width: "100%" },
            },
            style: padding,
          },
        });

        expect(block.type).toBe("button");
        if (block.type !== "button") throw new Error("expected a button");
        expect(block.width).toBe("full");
        expect(block.styles.padding).toEqual(returned);
      });

      it("keeps a video at its stated px width and still returns padding", () => {
        const narrow = leftBlock({
          type: "mailup-bee-newsletter-modules-video",
          descriptor: {
            video: {
              src: "https://www.youtube.com/watch?v=abcdefghijk",
              style: { width: "240px" },
            },
            style: padding,
          },
        });
        const wide = leftBlock({
          type: "mailup-bee-newsletter-modules-video",
          descriptor: {
            video: {
              src: "https://www.youtube.com/watch?v=abcdefghijk",
              style: { width: "500px" },
            },
            style: padding,
          },
        });

        expect(narrow.type).toBe("video");
        expect(wide.type).toBe("video");
        if (narrow.type !== "video" || wide.type !== "video") {
          throw new Error("expected video blocks");
        }
        expect(narrow.width).toBe(240);
        expect(wide.width).toBe(500);
        expect(narrow.styles.padding).toEqual(returned);
        expect(wide.styles.padding).toEqual(returned);
      });

      it("keeps a social row's icon size and still returns padding", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-social",
          descriptor: {
            computedStyle: { iconsDefaultWidth: "32px" },
            iconsList: {
              icons: [
                {
                  name: "facebook",
                  image: { href: "https://facebook.com/example" },
                },
              ],
            },
            style: padding,
          },
        });

        expect(block.type).toBe("social");
        if (block.type !== "social") throw new Error("expected a social block");
        expect(block.iconSize).toBe("medium");
        expect(block.styles.padding).toEqual(returned);
      });

      it("returns padding on a menu", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-menu",
          descriptor: {
            menu: {
              items: [{ text: "Home", link: "https://example.com" }],
            },
            style: padding,
          },
        });

        expect(block.type).toBe("menu");
        if (block.type !== "menu") throw new Error("expected a menu");
        expect(block.styles.padding).toEqual(returned);
      });

      // 7/12 of 600 is 350 and the even column is 300. The facing edge has no
      // padding, so none of the 50px shortfall comes back. 20px on the outer
      // edge stays, and the image is measured in the 280px that remain.
      describe("outer column padding that is not given back", () => {
        function photo(shown: string) {
          return {
            type: "mailup-bee-newsletter-modules-image",
            descriptor: {
              image: {
                src: "https://example.com/photo.png",
                alt: "Photo",
                width: "999px",
                height: "500px",
              },
              computedStyle: { class: "center fixedwidth", width: shown },
            },
          };
        }

        function imageBlock(block: Block) {
          expect(block.type).toBe("image");
          if (block.type !== "image") throw new Error("expected an image");
          return block;
        }

        it("measures a first column against the outer padding it keeps", () => {
          const row = (shown: string) =>
            sectionOf({
              columns: [
                {
                  "grid-columns": 7,
                  style: { "padding-left": "20px", "padding-right": "0px" },
                  modules: [photo(shown)],
                },
                { "grid-columns": 5, modules: [text()] },
              ],
            }).section.children[0][0];

          const fills = imageBlock(row("280px"));
          const wider = imageBlock(row("290px"));
          const short = imageBlock(row("279px"));
          const kept = { top: 0, right: 0, bottom: 0, left: 20 };

          expect(fills.width).toBe("full");
          expect(fills.styles.padding).toEqual(kept);
          expect(wider.width).toBe("full");
          expect(wider.styles.padding).toEqual(kept);
          expect(short.width).toBe(279);
          expect(short.styles.padding).toEqual(kept);
        });

        it("measures a second column against the outer padding it keeps", () => {
          const row = (shown: string) =>
            sectionOf({
              columns: [
                { "grid-columns": 5, modules: [text()] },
                {
                  "grid-columns": 7,
                  style: { "padding-left": "0px", "padding-right": "20px" },
                  modules: [photo(shown)],
                },
              ],
            }).section.children[1][0];

          const fills = imageBlock(row("280px"));
          const short = imageBlock(row("279px"));
          const kept = { top: 0, right: 20, bottom: 0, left: 0 };

          expect(fills.width).toBe("full");
          expect(fills.styles.padding).toEqual(kept);
          expect(short.width).toBe(279);
          expect(short.styles.padding).toEqual(kept);
        });

        it("measures padding kept on both sides when none of it comes back", () => {
          // The right column of a 7-5 row is wider than its 250px share, so
          // none of its padding comes back. 10px on each side leaves 280px.
          const row = (shown: string) =>
            sectionOf({
              columns: [
                { "grid-columns": 7, modules: [text()] },
                {
                  "grid-columns": 5,
                  style: { "padding-left": "10px", "padding-right": "10px" },
                  modules: [photo(shown)],
                },
              ],
            }).section.children[1][0];

          const fills = imageBlock(row("280px"));
          const short = imageBlock(row("279px"));
          const kept = { top: 0, right: 10, bottom: 0, left: 10 };

          expect(fills.width).toBe("full");
          expect(fills.styles.padding).toEqual(kept);
          expect(short.width).toBe(279);
          expect(short.styles.padding).toEqual(kept);
        });
      });

      it("returns padding on an HTML block and leaves its markup", () => {
        const block = leftBlock({
          type: "mailup-bee-newsletter-modules-html",
          descriptor: {
            html: { html: "<p>Hi</p>" },
            style: padding,
          },
        });

        expect(block.type).toBe("html");
        if (block.type !== "html") throw new Error("expected an html block");
        expect(block.content).toBe("<p>Hi</p>");
        expect(block.styles.padding).toEqual(returned);
      });
    });

    it("treats a non-positive column total as an even split", () => {
      const { section, report } = sectionOf({
        columns: [
          { "grid-columns": 0, modules: [text("<p>L</p>")] },
          { "grid-columns": 0, modules: [text("<p>R</p>")] },
        ],
      });

      expect(section.columns).toBe("2");
      expect(section.children).toHaveLength(2);
      expect(ratioNotes(report.warnings)).toEqual([
        'Column ratio 0-0 was mapped to the nearest layout "2".',
      ]);
    });

    it("keeps a zero-sum three-column row on the even layout", () => {
      // Grid shares 0, 1 and -1 sum to zero and are not equal, so each
      // thousandth stays 0.
      const { section, report } = sectionOf({
        columns: [
          { "grid-columns": 0, modules: [text("<p>L</p>")] },
          { "grid-columns": 1, modules: [text("<p>M</p>")] },
          { "grid-columns": -1, modules: [text("<p>R</p>")] },
        ],
      });

      expect(section.columns).toBe("3");
      expect(section.children).toHaveLength(3);
      expect(
        section.children.map((column) =>
          column[0].type === "paragraph" ? column[0].content : column[0].type,
        ),
      ).toEqual(["<p>L</p>", "<p>M</p>", "<p>R</p>"]);
      expect(ratioNotes(report.warnings)).toEqual([
        'Column ratio 0-1--1 was mapped to the nearest layout "3".',
      ]);
    });

    it("flattens five columns and names the four-column limit", () => {
      const { content, report } = convertRow({
        columns: [1, 2, 3, 4, 5].map((n) => ({
          "grid-columns": 3,
          modules: [text(`<p>${n}</p>`)],
        })),
      });

      expect(content.blocks.map((block) => block.type)).toEqual([
        "paragraph",
        "paragraph",
        "paragraph",
        "paragraph",
        "paragraph",
      ]);
      expect(ratioNotes(report.warnings)).toEqual([
        "Row with 5 columns (3-3-3-3-3) was flattened to a single column. BeeFree supports arbitrary columns, but Templatical supports up to four columns.",
      ]);
    });

    it("names an unequal four-column row snapped onto 4", () => {
      const { section, report } = sectionOf({
        columns: [6, 2, 2, 2].map((grid) => ({
          "grid-columns": grid,
          modules: [text()],
        })),
      });

      expect(section.columns).toBe("4");
      expect(section.children).toHaveLength(4);
      expect(ratioNotes(report.warnings)).toEqual([
        'Column ratio 6-2-2-2 was mapped to the nearest layout "4".',
      ]);
    });

    it("maps a row border onto the section and keeps a column border when both paint", () => {
      const rowOnly = sectionOf({
        content: {
          style: {
            "border-top": "2px dashed #112233",
            "border-right": "0px solid transparent",
            "border-bottom": "0px solid transparent",
            "border-left": "0px solid transparent",
          },
        },
        columns: [{ "grid-columns": 12, modules: [text()] }],
      });
      const conflict = sectionOf({
        content: { style: { "border-top": "4px solid #222222" } },
        columns: [
          {
            "grid-columns": 12,
            style: { "border-top": "1px solid #111111" },
            modules: [text()],
          },
        ],
      });
      const same = sectionOf({
        content: { style: { "border-top": "1px solid #111111" } },
        columns: [
          {
            "grid-columns": 12,
            style: { "border-top": "1px solid #111111" },
            modules: [text()],
          },
        ],
      });
      const multi = sectionOf({
        content: { style: { "border-top": "2px dashed #112233" } },
        columns: [
          { "grid-columns": 6, modules: [text()] },
          { "grid-columns": 6, modules: [text()] },
        ],
      });

      expect(rowOnly.section.border).toEqual({
        top: { width: 2, style: "dashed", color: "#112233" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
      expect(rowOnly.report.warnings).toEqual([]);
      expect(conflict.section.border).toEqual({
        top: { width: 1, style: "solid", color: "#111111" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 0, style: "solid", color: "#000000" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
      expect(conflict.report.warnings).toEqual([
        "Row border was dropped; the column border is kept on the section.",
      ]);
      expect(same.section.border?.top).toEqual({
        width: 1,
        style: "solid",
        color: "#111111",
      });
      expect(
        same.report.warnings.some((warning) => warning.includes("Row border")),
      ).toBe(false);
      expect(multi.section.border?.top).toEqual({
        width: 2,
        style: "dashed",
        color: "#112233",
      });
      expect(
        multi.report.warnings.some((warning) => warning.includes("Row border")),
      ).toBe(false);
    });
  });

  it("places an unknown social network in the column beside the social block", () => {
    const { content, report } = convertBeeFreeTemplate({
      page: {
        body: { content: { style: { width: "600px" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-social",
                    descriptor: {
                      iconsList: {
                        icons: [
                          {
                            id: "facebook",
                            name: "Facebook",
                            image: { href: "https://facebook.com/page" },
                          },
                          {
                            name: "adcce536-5143-4d1b-99fe-8a09dd82d583",
                            image: {
                              alt: "Vimeo",
                              href: "https://vimeo.com/example",
                              src: "https://cdn.example.com/vimeo.png",
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(content.blocks.map((block) => block.type)).toEqual([
      "social",
      "image",
    ]);
    const image = content.blocks[1];
    expect(image.type === "image" && image.src).toBe(
      "https://cdn.example.com/vimeo.png",
    );
    expect(image.type === "image" && image.linkUrl).toBe(
      "https://vimeo.com/example",
    );
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].status).toBe("approximated");
    expect(report.warnings).toEqual([
      'Social network "Vimeo" has no Templatical icon; imported as an image.',
    ]);
  });

  it("keeps a Xing icon on the social block", () => {
    const { content, report } = convertBeeFreeTemplate({
      page: {
        body: { content: { style: { width: "600px" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-social",
                    descriptor: {
                      iconsList: {
                        icons: [
                          {
                            id: "facebook",
                            name: "Facebook",
                            image: { href: "https://facebook.com/page" },
                          },
                          {
                            name: "adcce536-5143-4d1b-99fe-8a09dd82d583",
                            image: {
                              alt: "Xing",
                              href: "https://www.xing.com/pages/example",
                              src: "https://cdn.example.com/xing.png",
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(content.blocks.map((block) => block.type)).toEqual(["social"]);
    const social = content.blocks[0];
    expect(social.type).toBe("social");
    if (social.type !== "social") return;
    expect(social.icons.map((icon) => [icon.platform, icon.url])).toEqual([
      ["facebook", "https://facebook.com/page"],
      ["xing", "https://www.xing.com/pages/example"],
    ]);
    expect(report.warnings).toEqual([]);
    expect(report.entries[0].status).toBe("converted");
  });
});

describe("image fluidOnMobile", () => {
  function photo(width: string) {
    return {
      type: "mailup-bee-newsletter-modules-image",
      descriptor: {
        image: { src: "https://example.com/photo.png", alt: "Photo" },
        computedStyle: { class: "center autowidth", width },
      },
    };
  }

  function imagesIn(template: BeeFreeTemplate): ImageBlock[] {
    const { content } = convertBeeFreeTemplate(template);
    const images: ImageBlock[] = [];
    const walk = (blocks: Block[]) => {
      for (const block of blocks) {
        if (block.type === "image") images.push(block);
        if (block.type === "section") {
          for (const column of block.children) walk(column);
        }
      }
    };
    walk(content.blocks);
    return images;
  }

  it("pins a half-column image that fills only after column padding is folded", () => {
    // 270px in a 300px column, then 10px + 20px of column padding: the room
    // becomes 270, so the renderer would stretch it. BeeFree keeps 270.
    const [image, other] = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 6,
                style: { padding: "0px 20px 20px 10px" },
                modules: [photo("270px")],
              },
              {
                "grid-columns": 6,
                modules: [photo("100px")],
              },
            ],
          },
        ],
      },
    });

    expect(image.width).toBe(270);
    expect(image.styles.padding.left).toBe(10);
    expect(image.styles.padding.right).toBe(20);
    expect(image.fluidOnMobile).toBe(false);
    expect(other.width).toBe(100);
    expect(other.fluidOnMobile).toBeUndefined();
  });

  it("pins a third-column image the renderer floors to a fill, and not the wider last column", () => {
    // 33.33% of 600 is 199. A 199px image fills that column and not the
    // 33.34% column (200px).
    const images = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [4, 4, 4].map((grid) => ({
              "grid-columns": grid,
              modules: [photo("199px")],
            })),
          },
        ],
      },
    });

    expect(images.map((image) => image.width)).toEqual([199, 199, 199]);
    expect(images.map((image) => image.fluidOnMobile)).toEqual([
      false,
      false,
      undefined,
    ]);
  });

  it("pins an image that fills only after the section border shrinks the column", () => {
    // A 2px border on each side leaves 596px. Half of that is 298, under the
    // 300px share the width was measured against.
    const [image] = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            content: {
              style: {
                "border-left": "2px solid #000000",
                "border-right": "2px solid #000000",
              },
            },
            columns: [
              { "grid-columns": 6, modules: [photo("298px")] },
              { "grid-columns": 6, modules: [photo("100px")] },
            ],
          },
        ],
      },
    });

    expect(image.width).toBe(298);
    expect(image.fluidOnMobile).toBe(false);
  });

  it("uses unequal promoted edges to size column content", () => {
    const { content, report } = convertBeeFreeTemplate({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [
              {
                "grid-columns": 6,
                style: { "border-left": "1px solid #112233" },
                modules: [photo("298px")],
              },
              {
                "grid-columns": 6,
                style: { "border-right": "3px dotted #445566" },
                modules: [photo("100px")],
              },
            ],
          },
        ],
      },
    });
    const section = content.blocks[0];
    if (section?.type !== "section") throw new Error("expected a section");
    const image = section.children[0][0];
    if (image?.type !== "image") throw new Error("expected an image");

    // The 1px and 3px edges leave 596px, so each equal column has 298px.
    expect(image.width).toBe(298);
    expect(image.fluidOnMobile).toBe(false);
    expect(section.columns).toBe("2");
    expect(section.border).toEqual({
      top: { width: 0, style: "solid", color: "#000000" },
      right: { width: 3, style: "dotted", color: "#445566" },
      bottom: { width: 0, style: "solid", color: "#000000" },
      left: { width: 1, style: "solid", color: "#112233" },
    });
    expect(report.warnings).toEqual([]);
  });

  it("leaves a full-width row unset and pins an image that fills a quarter column", () => {
    const [hero] = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [{ "grid-columns": 12, modules: [photo("600px")] }],
          },
        ],
      },
    });
    expect(hero.width).toBe("full");
    expect(hero.fluidOnMobile).toBeUndefined();

    const [quarter] = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [3, 3, 3, 3].map((grid) => ({
              "grid-columns": grid,
              modules: [photo("600px")],
            })),
          },
        ],
      },
    });
    expect(quarter.width).toBe("full");
    expect(quarter.fluidOnMobile).toBe(false);

    const [flat] = imagesIn({
      page: {
        body: { content: { computedStyle: { messageWidth: "600px" } } },
        rows: [
          {
            columns: [3, 3, 3, 3, 3].map((grid) => ({
              "grid-columns": grid,
              modules: [photo("600px")],
            })),
          },
        ],
      },
    });
    expect(flat.width).toBe("full");
    expect(flat.fluidOnMobile).toBeUndefined();
  });
});
