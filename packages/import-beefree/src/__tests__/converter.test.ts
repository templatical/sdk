import { describe, it, expect } from "vitest";
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
      expect(block.content).toContain("<p>Hello World</p>");
      expect(block.content).toContain("color: #555555");
      expect(block.content).toContain("font-size: 14px");
      expect(block.content).toContain("text-align: center");
      expect(block.styles.padding).toEqual({
        top: 10,
        right: 20,
        bottom: 10,
        left: 20,
      });
    }

    expect(report.summary.converted).toBe(1);
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
      expect(block.width).toBe(80);
    }
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

    // All modules should be processed
    expect(report.summary.total).toBeGreaterThan(5);
    expect(report.summary.skipped).toBe(0);

    // Verify block types are present
    const types = content.blocks.map((b) => b.type);
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
