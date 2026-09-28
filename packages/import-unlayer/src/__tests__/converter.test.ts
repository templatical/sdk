import { describe, it, expect } from "vitest";
import { convertUnlayerTemplate } from "../converter";
import type {
  UnlayerContentValues,
  UnlayerRow,
  UnlayerTemplate,
} from "../types";
import fixture from "./fixtures/example-1.json" with { type: "json" };

const template = fixture as UnlayerTemplate;

describe("convertUnlayerTemplate", () => {
  it("throws when body.rows is missing", () => {
    expect(() => convertUnlayerTemplate({} as UnlayerTemplate)).toThrowError(
      /body\.rows/,
    );
  });

  it("extracts settings from body.values", () => {
    const { content } = convertUnlayerTemplate(template);
    expect(content.settings.width).toBe(640);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
  });

  // The hover colour and underline have no Templatical field, so the settings
  // carry exactly the keys below.
  it("maps the preheader, text colour and link style onto the settings", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {
          contentWidth: "600px",
          backgroundColor: "#f3f4f6",
          textColor: "#333333",
          preheaderText: "Introducing Launchpad v2.0",
          linkStyle: {
            body: true,
            linkColor: "#0F766E",
            linkHoverColor: "#115e59",
            linkUnderline: false,
            linkHoverUnderline: true,
          },
        },
        rows: [],
      },
    });

    expect(content.settings).toEqual({
      width: 600,
      backgroundColor: "#f3f4f6",
      textColor: "#333333",
      linkColor: "#0f766e",
      linkUnderline: false,
      fontFamily: "Arial",
      locale: "en",
      preheaderText: "Introducing Launchpad v2.0",
    });
  });

  // An underline is Unlayer's default, the browser's and the SDK's, so a
  // template that does not say keeps it.
  it("omits an empty preheader and link colour, and underlines links when unstated", () => {
    const blank = convertUnlayerTemplate({
      body: {
        values: { preheaderText: "   ", linkStyle: { linkColor: "" } },
        rows: [],
      },
    });
    expect(blank.content.settings).toEqual({
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      linkUnderline: true,
      fontFamily: "Arial",
      locale: "en",
    });

    const bare = convertUnlayerTemplate({ body: { values: {}, rows: [] } });
    expect(bare.content.settings.linkUnderline).toBe(true);
    expect("linkColor" in bare.content.settings).toBe(false);
    expect("preheaderText" in bare.content.settings).toBe(false);
  });

  // Paragraph spans are measured against the colour the template itself
  // sets, so a paragraph in the fallback colour inside a darker body keeps it.
  it("passes the template text colour down to paragraph colour spans", () => {
    const paragraphs = (textColor?: string) => {
      const { content } = convertUnlayerTemplate({
        body: {
          values: textColor ? { textColor } : {},
          rows: [
            {
              cells: [1],
              columns: [
                {
                  contents: [
                    {
                      type: "text",
                      values: { text: "<p>a</p>", color: "#1a1a1a" },
                    },
                    {
                      type: "text",
                      values: { text: "<p>b</p>", color: "#333333" },
                    },
                  ],
                  values: {},
                },
              ],
              values: {},
            },
          ],
        },
      });
      const section = content.blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      return section.children[0].map((block) =>
        block.type === "paragraph" ? block.content : block.type,
      );
    };

    expect(paragraphs("#333333")).toEqual([
      '<p><span style="color: #1a1a1a">a</span></p>',
      "<p>b</p>",
    ]);
    expect(paragraphs()).toEqual([
      "<p>a</p>",
      '<p><span style="color: #333333">b</span></p>',
    ]);
  });

  describe("divider width against its column", () => {
    function dividerWidthIn(
      cells: number[],
      columnIndex: number,
      divider: UnlayerContentValues,
      contentWidth?: string | number,
    ) {
      const { content } = convertUnlayerTemplate({
        body: {
          values:
            contentWidth === undefined
              ? {}
              : { contentWidth: contentWidth as string },
          rows: [
            {
              cells,
              columns: cells.map((_, index) => ({
                contents:
                  index === columnIndex
                    ? [{ type: "divider", values: divider }]
                    : [],
                values: {},
              })),
              values: {},
            },
          ],
        },
      });
      const section = content.blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      const block = section.children.flat()[0];
      if (block?.type !== "divider") throw new Error("expected a divider");
      return block.width;
    }

    it("imports a px divider as wide as its single column as full", () => {
      expect(dividerWidthIn([1], 0, { width: "600px" }, "600px")).toBe("full");
      expect(dividerWidthIn([1], 0, { width: "599px" }, "600px")).toBe(599);
    });

    // [1, 2] resolves to "1-2": a 200px and a 400px column in a 600px body.
    it("measures a px divider against its own column", () => {
      expect(dividerWidthIn([1, 2], 0, { width: "200px" }, "600px")).toBe(
        "full",
      );
      expect(dividerWidthIn([1, 2], 1, { width: "300px" }, "600px")).toBe(300);
      expect(dividerWidthIn([1, 2], 1, { width: "400px" }, "600px")).toBe(
        "full",
      );
    });

    // A 300px column with 20px either side leaves the line 260px.
    it("measures against the column less the divider's side padding", () => {
      const padding = { containerPadding: "16px 20px" };
      expect(
        dividerWidthIn([1, 1], 1, { ...padding, width: "260px" }, "600px"),
      ).toBe("full");
      expect(
        dividerWidthIn([1, 1], 1, { ...padding, width: "259px" }, "600px"),
      ).toBe(259);
    });

    // 66.67% of 640px is 426.67px; the renderer draws that column 426px wide.
    it("rounds a column's width down, as the renderer does", () => {
      expect(dividerWidthIn([1, 2], 1, { width: "426px" }, "640px")).toBe(
        "full",
      );
    });

    // The body is `settings.width`: a px contentWidth, else 600. Unlayer
    // writes contentWidth as a px string, a percentage, or a bare number.
    it("measures against settings.width whatever contentWidth states", () => {
      expect(dividerWidthIn([1], 0, { width: "600px" })).toBe("full");
      expect(dividerWidthIn([1], 0, { width: "599px" })).toBe(599);
      expect(dividerWidthIn([1], 0, { width: "600px" }, "100%")).toBe("full");
      expect(dividerWidthIn([1], 0, { width: "700px" }, 700)).toBe("full");
      expect(dividerWidthIn([1], 0, { width: "699px" }, 700)).toBe(699);
    });

    it("falls back to a 600px body for a negative contentWidth", () => {
      const { content } = convertUnlayerTemplate({
        body: { values: { contentWidth: "-600px" }, rows: [] },
      });
      expect(content.settings.width).toBe(600);
      expect(dividerWidthIn([1], 0, { width: "600px" }, "-600px")).toBe("full");
    });

    // A 4+ column row flattens into one column as wide as the body.
    it("measures a divider in a flattened row against the whole body", () => {
      expect(dividerWidthIn([1, 1, 1, 1], 0, { width: "150px" }, "600px")).toBe(
        150,
      );
      expect(dividerWidthIn([1, 1, 1, 1], 3, { width: "600px" }, "600px")).toBe(
        "full",
      );
    });

    // The renderer draws a column past the layout's last slot at the whole
    // body width.
    it("measures a column past the layout's slots against the whole body", () => {
      function widthInThirdColumn(width: string) {
        const { content } = convertUnlayerTemplate({
          body: {
            values: { contentWidth: "600px" },
            rows: [
              {
                cells: [1, 1],
                columns: [
                  { contents: [], values: {} },
                  { contents: [], values: {} },
                  {
                    contents: [{ type: "divider", values: { width } }],
                    values: {},
                  },
                ],
                values: {},
              },
            ],
          },
        });
        const section = content.blocks[0];
        if (section.type !== "section") throw new Error("expected a section");
        const divider = section.children[2]?.[0];
        if (divider?.type !== "divider") throw new Error("expected a divider");
        return divider.width;
      }

      expect(widthInThirdColumn("600px")).toBe("full");
      expect(widthInThirdColumn("599px")).toBe(599);
    });
  });

  it("emits a section for every row including single-column rows", () => {
    const { content } = convertUnlayerTemplate(template);
    const blocks = content.blocks;

    expect(blocks).toHaveLength(5);

    expect(blocks[0].type).toBe("section");
    if (blocks[0].type === "section") {
      expect(blocks[0].columns).toBe("1");
      expect(blocks[0].children[0]).toHaveLength(2);
      expect(blocks[0].children[0][0].type).toBe("title");
      expect(blocks[0].children[0][1].type).toBe("paragraph");
    }

    expect(blocks[1].type).toBe("section");
    if (blocks[1].type === "section") {
      expect(blocks[1].columns).toBe("2");
      expect(blocks[1].children).toHaveLength(2);
      expect(blocks[1].children[0][0].type).toBe("image");
      expect(blocks[1].children[1][0].type).toBe("button");
      expect(blocks[1].styles?.backgroundColor).toBe("#fafafa");
    }

    expect(blocks[2].type).toBe("section");
    if (blocks[2].type === "section") {
      expect(blocks[2].columns).toBe("2-1");
    }

    expect(blocks[3].type).toBe("section");
    if (blocks[3].type === "section") {
      expect(blocks[3].columns).toBe("1");
      const inner = blocks[3].children[0];
      expect(inner[0].type).toBe("menu");
      expect(inner[1].type).toBe("social");
      expect(inner[2].type).toBe("video");
      expect(inner[3].type).toBe("html");
      expect(inner[4].type).toBe("html");
      expect(inner[5].type).toBe("html");
    }

    expect(blocks[4].type).toBe("section");
    if (blocks[4].type === "section") {
      expect(blocks[4].columns).toBe("1");
    }
  });

  it("flattens 4+ column rows and warns", () => {
    const { report } = convertUnlayerTemplate(template);
    expect(
      report.warnings.some((w) => w.includes("flattened to a single column")),
    ).toBe(true);
  });

  it("reports correct status counts", () => {
    const { report } = convertUnlayerTemplate(template);
    const summary = report.summary;

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.skipped).toBe(1); // form
    expect(summary.htmlFallback).toBe(2); // timer + custom-tool
    expect(summary.approximated).toBe(1); // menu
    expect(summary.converted).toBeGreaterThanOrEqual(7);
  });

  it("marks form as skipped with null block type", () => {
    const { report } = convertUnlayerTemplate(template);
    const formEntry = report.entries.find(
      (e) => e.unlayerContentType === "form",
    );
    expect(formEntry).toBeDefined();
    expect(formEntry?.status).toBe("skipped");
    expect(formEntry?.templaticalBlockType).toBeNull();
  });

  it("marks timer as html-fallback", () => {
    const { report } = convertUnlayerTemplate(template);
    const timerEntry = report.entries.find(
      (e) => e.unlayerContentType === "timer",
    );
    expect(timerEntry?.status).toBe("html-fallback");
    expect(timerEntry?.templaticalBlockType).toBe("html");
  });

  it("resolves [1,2] cells to '1-2' layout", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1, 2],
            columns: [
              { contents: [], values: {} },
              { contents: [], values: {} },
            ],
            values: {},
          },
        ],
      },
    });
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("1-2");
    }
  });

  it("resolves [1,1,1] cells to '3' layout", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1, 1, 1],
            columns: [
              { contents: [], values: {} },
              { contents: [], values: {} },
              { contents: [], values: {} },
            ],
            values: {},
          },
        ],
      },
    });
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("3");
    }
  });

  it("wraps single-column rows in a section preserving row backgroundColor", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            columns: [
              {
                contents: [{ type: "text", values: { text: "<p>hi</p>" } }],
                values: {},
              },
            ],
            values: { backgroundColor: "#abcdef" },
          },
        ],
      },
    });

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("1");
      expect(section.styles?.backgroundColor).toBe("#abcdef");
      expect(section.children[0]).toHaveLength(1);
      expect(section.children[0][0].type).toBe("paragraph");
    }
  });

  it("propagates row padding shorthand to section padding", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1, 1],
            columns: [
              { contents: [], values: {} },
              { contents: [], values: {} },
            ],
            values: { padding: "10px 20px" },
          },
        ],
      },
    });

    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.styles?.padding).toEqual({
        top: 10,
        right: 20,
        bottom: 10,
        left: 20,
      });
    }
  });

  // `columnsBackgroundColor` fills the content width, which is the area a
  // section paints; `backgroundColor` is the band outside it.
  it("paints the section with the row's columnsBackgroundColor", () => {
    const { content, report } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1, 1],
            columns: [
              { contents: [], values: {} },
              { contents: [], values: {} },
            ],
            values: { columnsBackgroundColor: "#123456" },
          },
        ],
      },
    });

    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.styles?.backgroundColor).toBe("#123456");
    }
    expect(report.warnings).toEqual([]);
  });

  describe("row backgrounds", () => {
    function convertRow(values: UnlayerRow["values"]) {
      const { content, report } = convertUnlayerTemplate({
        body: {
          values: {},
          rows: [
            {
              cells: [1],
              columns: [{ contents: [], values: {} }],
              values,
            },
          ],
        },
      });
      const section = content.blocks[0];
      if (section.type !== "section") throw new Error("expected a section");
      return { section, warnings: report.warnings };
    }

    it("prefers the content background and warns naming the dropped row background", () => {
      const { section, warnings } = convertRow({
        backgroundColor: "#1d1d1f",
        columnsBackgroundColor: "#000000",
      });
      expect(section.styles.backgroundColor).toBe("#000000");
      expect(warnings).toEqual([
        "Row background #1d1d1f outside the content width was dropped; the section keeps the content background #000000.",
      ]);
    });

    it("does not warn when both backgrounds are the same colour", () => {
      const { section, warnings } = convertRow({
        backgroundColor: "#FFF",
        columnsBackgroundColor: "#ffffff",
      });
      expect(section.styles.backgroundColor).toBe("#ffffff");
      expect(warnings).toEqual([]);
    });

    it("falls back to the row background when the content background is empty or transparent", () => {
      expect(
        convertRow({ backgroundColor: "#abcdef", columnsBackgroundColor: "" })
          .section.styles.backgroundColor,
      ).toBe("#abcdef");
      const transparent = convertRow({
        backgroundColor: "#abcdef",
        columnsBackgroundColor: "transparent",
      });
      expect(transparent.section.styles.backgroundColor).toBe("#abcdef");
      expect(transparent.warnings).toEqual([]);
    });
  });

  it("wraps 4+ column rows in a single-column section instead of dropping the wrapper", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1, 1, 1, 1],
            columns: [
              {
                contents: [{ type: "text", values: { text: "<p>a</p>" } }],
                values: {},
              },
              {
                contents: [{ type: "text", values: { text: "<p>b</p>" } }],
                values: {},
              },
              { contents: [], values: {} },
              { contents: [], values: {} },
            ],
            values: { backgroundColor: "#eeeeee" },
          },
        ],
      },
    });

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.columns).toBe("1");
      expect(section.styles?.backgroundColor).toBe("#eeeeee");
      expect(section.children[0]).toHaveLength(2);
    }
  });

  it("emits a visible placeholder for unsupported block fallbacks", () => {
    const { content } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            columns: [
              {
                contents: [{ type: "timer", values: {} }],
                values: {},
              },
            ],
            values: {},
          },
        ],
      },
    });

    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      const fallback = section.children[0][0];
      expect(fallback.type).toBe("html");
      if (fallback.type === "html") {
        expect(fallback.content).not.toMatch(/^<!--[\s\S]*-->$/);
        expect(fallback.content).toMatch(/timer/i);
      }
    }
  });

  it("imports headers and footers as wrapping rows with warnings", () => {
    const { content, report } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            columns: [
              {
                contents: [{ type: "text", values: { text: "<p>middle</p>" } }],
                values: {},
              },
            ],
            values: {},
          },
        ],
        headers: [
          {
            cells: [1],
            columns: [
              {
                contents: [{ type: "text", values: { text: "<p>head</p>" } }],
                values: {},
              },
            ],
            values: {},
          },
        ],
        footers: [
          {
            cells: [1],
            columns: [
              {
                contents: [{ type: "text", values: { text: "<p>foot</p>" } }],
                values: {},
              },
            ],
            values: {},
          },
        ],
      },
    });

    expect(content.blocks).toHaveLength(3);
    expect(report.warnings.some((w) => w.includes("header"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("footer"))).toBe(true);
  });
});
