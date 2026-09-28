import { describe, it, expect } from "vitest";
import type { Block, DividerBlock } from "@templatical/types";
import { convertBeeFreeTemplate } from "../converter";
import type { BeeFreeTemplate } from "../types";
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

  it("flattens 4+ columns with warning", () => {
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

    // Flattened — no section, just individual blocks
    expect(content.blocks.some((b) => b.type === "spacer")).toBe(true);
    expect(report.warnings.some((w) => w.includes("4 columns"))).toBe(true);
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

    // A 4+ column row is flattened, so its modules end up spanning the body.
    it("measures a flattened row's dividers against the body width", () => {
      const { content } = convertBeeFreeTemplate({
        page: {
          body: { content: { style: { width: "600px" } } },
          rows: [
            {
              columns: [
                { "grid-columns": 3, modules: [divider("130px")] },
                { "grid-columns": 3, modules: [] },
                { "grid-columns": 3, modules: [] },
                { "grid-columns": 3, modules: [] },
              ],
            },
          ],
        },
      });
      expect(widthsOf(content.blocks)).toEqual([130]);
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

  it("converts real BeeFree fixture", () => {
    const { content, report } = convertBeeFreeTemplate(
      fixture as BeeFreeTemplate,
    );

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

  it("warns about multiple web fonts", () => {
    const template: BeeFreeTemplate = {
      page: {
        rows: [],
        body: {
          webFonts: [
            { name: "Montserrat" },
            { name: "Open Sans" },
            { name: "Roboto" },
          ],
        },
      },
    };

    const { report } = convertBeeFreeTemplate(template);
    expect(report.warnings.some((w) => w.includes("web fonts"))).toBe(true);
  });
});
