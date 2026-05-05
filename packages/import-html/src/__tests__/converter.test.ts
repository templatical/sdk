import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertHtmlTemplate } from "../converter";
import type { Block, SectionBlock } from "@templatical/types";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf-8");
}

function findBlock<T extends Block["type"]>(
  blocks: Block[],
  type: T,
): Extract<Block, { type: T }> | undefined {
  for (const block of blocks) {
    if (block.type === type) return block as Extract<Block, { type: T }>;
    if (block.type === "section") {
      const section = block as SectionBlock;
      for (const col of section.children) {
        const found = findBlock(col, type);
        if (found) return found;
      }
    }
  }
  return undefined;
}

describe("convertHtmlTemplate — input validation", () => {
  it("throws on non-string input", () => {
    // @ts-expect-error - intentional bad input
    expect(() => convertHtmlTemplate(null)).toThrow(/expected a string/);
    // @ts-expect-error - intentional bad input
    expect(() => convertHtmlTemplate(123)).toThrow(/expected a string/);
  });

  it("throws on empty string input", () => {
    expect(() => convertHtmlTemplate("")).toThrow(/empty/);
    expect(() => convertHtmlTemplate("   ")).toThrow(/empty/);
  });
});

describe("convertHtmlTemplate — minimal email", () => {
  const result = convertHtmlTemplate(fixture("minimal.html"));

  it("returns a content + report shape", () => {
    expect(result.content).toBeDefined();
    expect(result.content.blocks).toBeInstanceOf(Array);
    expect(result.content.settings).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.report.entries).toBeInstanceOf(Array);
  });

  it("extracts settings from body styles + table width", () => {
    expect(result.content.settings.backgroundColor).toBe("#f5f5f5");
    expect(result.content.settings.fontFamily).toBe("Arial");
    expect(result.content.settings.width).toBe(600);
  });

  it("produces three section blocks (one per row)", () => {
    expect(result.content.blocks).toHaveLength(3);
    expect(result.content.blocks[0].type).toBe("section");
  });

  it("converts h1 to title block", () => {
    const title = findBlock(result.content.blocks, "title");
    expect(title).toBeDefined();
    expect(title!.level).toBe(1);
    expect(title!.content).toContain("Welcome aboard");
  });

  it("converts p to paragraph block", () => {
    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("Thanks for signing up");
  });

  it("recognizes styled anchor in cell as button block", () => {
    const button = findBlock(result.content.blocks, "button");
    expect(button).toBeDefined();
    expect(button!.text).toBe("Verify email");
    expect(button!.url).toBe("https://example.com/verify");
    expect(button!.openInNewTab).toBe(true);
    expect(button!.backgroundColor).toBe("#4f46e5");
  });

  it("report summary counts converted entries", () => {
    expect(result.report.summary.total).toBeGreaterThan(0);
    expect(result.report.summary.converted).toBeGreaterThan(0);
    expect(result.report.summary.skipped).toBe(0);
  });
});

describe("convertHtmlTemplate — multi-column", () => {
  const result = convertHtmlTemplate(fixture("multi-column.html"));

  it("two-column row produces section with columns='2'", () => {
    const first = result.content.blocks[0] as SectionBlock;
    expect(first.type).toBe("section");
    expect(first.columns).toBe("2");
    expect(first.children).toHaveLength(2);
  });

  it("three-column row produces section with columns='3'", () => {
    const second = result.content.blocks[1] as SectionBlock;
    expect(second.type).toBe("section");
    expect(second.columns).toBe("3");
    expect(second.children).toHaveLength(3);
  });

  it("4+ column row flattens to '1' and emits a warning", () => {
    const third = result.content.blocks[2] as SectionBlock;
    expect(third.type).toBe("section");
    expect(third.columns).toBe("1");
    const flattenWarn = result.report.warnings.find((w) =>
      w.includes("flattened"),
    );
    expect(flattenWarn).toBeDefined();
  });
});

describe("convertHtmlTemplate — <style> block resolution", () => {
  const result = convertHtmlTemplate(fixture("with-style-block.html"));

  it("body class background resolves into settings", () => {
    expect(result.content.settings.backgroundColor).toBe("#efefef");
  });

  it("h1 color comes from <style> rule", () => {
    const title = findBlock(result.content.blocks, "title");
    expect(title).toBeDefined();
    expect(title!.color).toBe("#ff0000");
  });

  it("p font-size comes from <style> rule", () => {
    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("font-size: 14px");
  });

  it("@media rules are not applied", () => {
    const title = findBlock(result.content.blocks, "title");
    expect(title!.color).not.toBe("#0000ff");
  });
});

describe("convertHtmlTemplate — preheader", () => {
  const result = convertHtmlTemplate(fixture("preheader.html"));

  it("captures hidden preheader div text into settings", () => {
    expect(result.content.settings.preheaderText).toBe(
      "Preheader text shown in inbox preview.",
    );
  });

  it("does not emit a paragraph block for the preheader", () => {
    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeUndefined();
  });
});

describe("convertHtmlTemplate — spacer and divider", () => {
  const result = convertHtmlTemplate(fixture("spacer-and-divider.html"));

  it("recognizes empty cell with height as spacer", () => {
    const spacer = findBlock(result.content.blocks, "spacer");
    expect(spacer).toBeDefined();
    expect(spacer!.height).toBe(40);
  });

  it("converts hr to divider", () => {
    const divider = findBlock(result.content.blocks, "divider");
    expect(divider).toBeDefined();
    expect(divider!.thickness).toBe(2);
    expect(divider!.color).toBe("#cccccc");
  });
});

describe("convertHtmlTemplate — non-table HTML", () => {
  const result = convertHtmlTemplate(fixture("non-table.html"));

  it("still produces blocks (wrapped in a single-column section)", () => {
    expect(result.content.blocks.length).toBeGreaterThan(0);
    const first = result.content.blocks[0] as SectionBlock;
    expect(first.type).toBe("section");
    expect(first.columns).toBe("1");
  });

  it("h1 + p still convert correctly", () => {
    const title = findBlock(result.content.blocks, "title");
    const para = findBlock(result.content.blocks, "paragraph");
    expect(title).toBeDefined();
    expect(para).toBeDefined();
  });
});

describe("convertHtmlTemplate — empty body", () => {
  it("returns empty blocks list with a warning when body has no convertible content", () => {
    const r = convertHtmlTemplate("<html><body></body></html>");
    expect(r.content.blocks).toEqual([]);
    expect(
      r.report.warnings.some((w) => w.includes("No convertible content")),
    ).toBe(true);
  });
});

describe("convertHtmlTemplate — script/noscript stripping", () => {
  it("removes <script> and <noscript> from output", () => {
    const r = convertHtmlTemplate(`
      <html><body>
        <script>alert(1)</script>
        <noscript>fallback</noscript>
        <table><tr><td><p>visible</p></td></tr></table>
      </body></html>
    `);
    const para = findBlock(r.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("visible");
    expect(para!.content).not.toContain("alert");
  });
});

describe("convertHtmlTemplate — html-fallback for unknown elements", () => {
  it("preserves unknown custom element as html block", () => {
    const r = convertHtmlTemplate(
      "<html><body><table><tr><td><custom-thing>x</custom-thing></td></tr></table></body></html>",
    );
    const fallback = r.report.entries.find((e) => e.status === "html-fallback");
    expect(fallback).toBeDefined();
    expect(fallback!.sourceTag).toBe("custom-thing");
  });
});

describe("convertHtmlTemplate — data table preservation", () => {
  it("table without layout content preserved as html block with html-fallback status", () => {
    const r = convertHtmlTemplate(
      "<html><body><table><tr><td>Name</td><td>Age</td></tr><tr><td>Ada</td><td>30</td></tr></table></body></html>",
    );
    const dataFallback = r.report.entries.find(
      (e) => e.sourceTag === "table" && e.status === "html-fallback",
    );
    expect(dataFallback).toBeDefined();
  });
});
