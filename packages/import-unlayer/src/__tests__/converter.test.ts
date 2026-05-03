import { describe, it, expect } from "vitest";
import { convertUnlayerTemplate } from "../converter";
import type { UnlayerTemplate } from "../types";
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

  it("does not use columnsBackgroundColor as the row backgroundColor", () => {
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
            values: { columnsBackgroundColor: "#123456" },
          },
        ],
      },
    });

    const section = content.blocks[0];
    expect(section.type).toBe("section");
    if (section.type === "section") {
      expect(section.styles?.backgroundColor).toBeUndefined();
    }
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
