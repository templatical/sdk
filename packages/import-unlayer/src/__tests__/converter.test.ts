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

  it("emits a section for the [1,1] row and inline blocks for single-column rows", () => {
    const { content } = convertUnlayerTemplate(template);
    const blocks = content.blocks;

    // r1: single column → inline (heading + text) = 2 blocks
    expect(blocks[0].type).toBe("title");
    expect(blocks[1].type).toBe("paragraph");

    // r2: [1,1] → SectionBlock with layout '2'
    expect(blocks[2].type).toBe("section");
    if (blocks[2].type === "section") {
      expect(blocks[2].columns).toBe("2");
      expect(blocks[2].children).toHaveLength(2);
      expect(blocks[2].children[0][0].type).toBe("image");
      expect(blocks[2].children[1][0].type).toBe("button");
      expect(blocks[2].styles?.backgroundColor).toBe("#fafafa");
    }

    // r3: [2,1] → SectionBlock with layout '2-1'
    expect(blocks[3].type).toBe("section");
    if (blocks[3].type === "section") {
      expect(blocks[3].columns).toBe("2-1");
    }

    // r4: single column with menu, social, video, timer, form, custom
    expect(blocks[4].type).toBe("menu");
    expect(blocks[5].type).toBe("social");
    expect(blocks[6].type).toBe("video");
    expect(blocks[7].type).toBe("html"); // timer fallback
    expect(blocks[8].type).toBe("html"); // form skipped placeholder
    expect(blocks[9].type).toBe("html"); // unknown
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
