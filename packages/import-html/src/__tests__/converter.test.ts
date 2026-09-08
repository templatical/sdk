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

describe("convertHtmlTemplate — <center> wrapper recursion", () => {
  const result = convertHtmlTemplate(fixture("center-wrapper.html"));

  it("recurses into a <center>-wrapped table and converts its content", () => {
    expect(result.content.blocks).toHaveLength(1);
    const section = result.content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");

    const title = findBlock(result.content.blocks, "title");
    expect(title).toBeDefined();
    expect(title!.level).toBe(1);
    expect(title!.content).toContain("Centered heading");

    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("Inside a center-wrapped table");
  });
});

describe("convertHtmlTemplate — <main> wrapper recursion", () => {
  const result = convertHtmlTemplate(fixture("main-wrapper.html"));

  it("recurses into a <main>-wrapped table and converts its content", () => {
    expect(result.content.blocks).toHaveLength(1);
    const section = result.content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");

    const title = findBlock(result.content.blocks, "title");
    expect(title).toBeDefined();
    expect(title!.content).toContain("Main heading");

    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("Inside a main-wrapped table");
  });
});

describe("convertHtmlTemplate — div wrapping a table with no loose siblings", () => {
  const result = convertHtmlTemplate(fixture("div-wrapped-table.html"));

  it("emits exactly one section and no spurious empty wrapper section", () => {
    // The wrapping <div> has only the table as a child — no loose content. The
    // flushLoose calls around the table must not emit an empty single-column
    // section, so the result is exactly the table's one section.
    expect(result.content.blocks).toHaveLength(1);
    const section = result.content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");

    const para = findBlock(result.content.blocks, "paragraph");
    expect(para).toBeDefined();
    expect(para!.content).toContain("Only table content");

    // None of the sections is an empty wrapper (every column has content).
    const emptySection = result.content.blocks.find(
      (b) =>
        b.type === "section" &&
        (b as SectionBlock).children.every((col) => col.length === 0),
    );
    expect(emptySection).toBeUndefined();
  });
});

describe("convertHtmlTemplate — div wrapping a table with loose siblings", () => {
  it("flushes loose content before AND after the table into their own sections", () => {
    const html = `<!doctype html><html><body>
      <div>
        <h1>Before</h1>
        <table role="presentation"><tr><td><p>Inside</p></td></tr></table>
        <p>After</p>
      </div>
    </body></html>`;
    const { content } = convertHtmlTemplate(html);

    // Three sections: leading loose (h1), the table, trailing loose (p).
    expect(content.blocks).toHaveLength(3);
    expect(content.blocks.every((b) => b.type === "section")).toBe(true);

    const serialized = JSON.stringify(content.blocks);
    const beforeIdx = serialized.indexOf("Before");
    const insideIdx = serialized.indexOf("Inside");
    const afterIdx = serialized.indexOf("After");
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(insideIdx).toBeGreaterThan(beforeIdx);
    expect(afterIdx).toBeGreaterThan(insideIdx);
  });
});

describe("convertHtmlTemplate — wrapper-div recursion ordering", () => {
  it("keeps loose content before a nested table in source order", () => {
    const html = `<!doctype html><html><body>
      <div>
        <h1>Heading before table</h1>
        <table role="presentation"><tr><td>Inside table cell</td></tr></table>
        <p>Paragraph after table</p>
      </div>
    </body></html>`;

    const { content } = convertHtmlTemplate(html);

    // The blocks array reflects document order, so locate each marker by its
    // position in the serialized tree. With the bug, the table is pushed
    // immediately while loose siblings are flushed only AFTER the loop, so the
    // leading heading lands after the table content.
    const serialized = JSON.stringify(content.blocks);
    const headingIdx = serialized.indexOf("Heading before table");
    const cellIdx = serialized.indexOf("Inside table cell");
    const paraIdx = serialized.indexOf("Paragraph after table");

    expect(headingIdx).toBeGreaterThanOrEqual(0);
    expect(cellIdx).toBeGreaterThanOrEqual(0);
    expect(paraIdx).toBeGreaterThanOrEqual(0);
    expect(headingIdx).toBeLessThan(cellIdx);
    expect(cellIdx).toBeLessThan(paraIdx);
  });
});

describe("convertHtmlTemplate — a table nested more than one container deep", () => {
  const html = `<!doctype html><html><body>
    <div>
      <div>
        <table role="presentation"><tr>
          <td><h1>Left column heading</h1></td>
          <td><p>Right column copy</p></td>
        </tr></table>
      </div>
    </div>
  </body></html>`;

  it("reaches processTable and yields the row's real column layout", () => {
    const { content } = convertHtmlTemplate(html);

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    // "2" is not the section factory's default, so this cannot be satisfied by
    // a default that merely survived — it is the row's own cell count.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((col) => col.map((b) => b.type))).toEqual([
      ["title"],
      ["paragraph"],
    ]);
  });

  it("reports the cells' own source tags, not the wrapping containers", () => {
    const { report } = convertHtmlTemplate(html);

    // The two wrapping divs contribute nothing; `tr` is the layout row that
    // produced the section, which is a structural fact rather than a wrapper.
    expect(report.entries.map((entry) => entry.sourceTag)).toEqual([
      "h1",
      "p",
      "tr",
    ]);
    expect(report.summary).toEqual({
      total: 3,
      converted: 3,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("leaves no block holding the table subtree as raw markup", () => {
    const { content } = convertHtmlTemplate(html);

    // A container that is not descended into falls to convertElement, where
    // `div` is a text tag — so the whole table lands inside one paragraph's
    // content. No block may carry table markup.
    expect(JSON.stringify(content.blocks)).not.toContain("<table");
    expect(JSON.stringify(content.blocks)).not.toContain("<td");
  });

  it("keeps loose siblings around a deeply nested table in source order", () => {
    const { content } = convertHtmlTemplate(`<!doctype html><html><body>
      <div>
        <h1>Heading before nesting</h1>
        <div>
          <table role="presentation"><tr><td><p>Inside nested table cell</p></td></tr></table>
        </div>
        <p>Paragraph after nesting</p>
      </div>
    </body></html>`);

    // Three sections: leading loose (h1), the nested table, trailing loose (p).
    // The accumulator holding loose blocks is shared across nesting levels, so
    // the heading flushes at the table's position rather than after the walk.
    expect(content.blocks).toHaveLength(3);
    expect(content.blocks.map((b) => b.type)).toEqual([
      "section",
      "section",
      "section",
    ]);

    const serialized = JSON.stringify(content.blocks);
    const headingIdx = serialized.indexOf("Heading before nesting");
    const cellIdx = serialized.indexOf("Inside nested table cell");
    const paraIdx = serialized.indexOf("Paragraph after nesting");
    expect(headingIdx).toBeGreaterThanOrEqual(0);
    expect(headingIdx).toBeLessThan(cellIdx);
    expect(cellIdx).toBeLessThan(paraIdx);
  });

  it("leaves a nested container holding no table as a paragraph", () => {
    const { content, report } = convertHtmlTemplate(`<!doctype html><html><body>
      <div>
        <table role="presentation"><tr><td><h1>Table heading</h1></td></tr></table>
        <div><p>Sidebar note</p></div>
      </div>
    </body></html>`);

    // The descent is gated on the container holding a table. A container
    // without one keeps its text-tag mapping, so the recursion cannot widen
    // into "descend every div" and split ordinary copy into extra blocks.
    expect(content.blocks).toHaveLength(2);
    const loose = content.blocks[1] as SectionBlock;
    expect(loose.columns).toBe("1");
    expect(loose.children).toHaveLength(1);
    expect(loose.children[0].map((b) => b.type)).toEqual(["paragraph"]);
    // In source order: the table cell's heading, the row that made its
    // section, the un-descended container's paragraph, and the synthetic
    // section that collected it.
    expect(report.entries.map((entry) => entry.sourceTag)).toEqual([
      "h1",
      "tr",
      "div",
      "body",
    ]);
  });
});

describe("convertHtmlTemplate — every section is accounted for in the report", () => {
  it("names the synthetic section that collects loose top-level content", () => {
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body><h1>Loose heading</h1><p>Loose copy.</p></body></html>`,
    );

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);

    // The section has no source row of its own, so `body` is what it came
    // from — a machine-readable marker a caller can filter on without
    // parsing the note.
    expect(report.entries).toEqual([
      { sourceTag: "h1", templaticalBlockType: "title", status: "converted" },
      {
        sourceTag: "p",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      {
        sourceTag: "body",
        templaticalBlockType: "section",
        status: "converted",
        note: "Loose top-level content was grouped into a synthetic single-column section.",
      },
    ]);
    expect(report.summary).toEqual({
      total: 3,
      converted: 3,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("closes the summary arithmetic over a hand-enumerated fixture", () => {
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body>
        <table role="presentation"><tr>
          <td><h1>Left heading</h1></td>
          <td><p>Right copy</p></td>
        </tr></table>
        <table><tr><td>Name</td><td>Age</td></tr><tr><td>Ada</td><td>30</td></tr></table>
      </body></html>`,
    );

    // Enumerated by hand from the markup: the layout row's two cells give a
    // title and a paragraph, the row itself gives a section, and the bare
    // data table falls back to one html block. Four entries, three of them
    // converted and one an html fallback.
    expect(content.blocks.map((b) => b.type)).toEqual(["section", "html"]);
    expect(
      report.entries.map((entry) => [entry.sourceTag, entry.status]),
    ).toEqual([
      ["h1", "converted"],
      ["p", "converted"],
      ["tr", "converted"],
      ["table", "html-fallback"],
    ]);
    expect(report.summary).toEqual({
      total: 4,
      converted: 3,
      approximated: 0,
      htmlFallback: 1,
      skipped: 0,
    });

    // The four status counts partition the entries, so they must sum to the
    // total rather than merely each being under it.
    const { total, converted, approximated, htmlFallback, skipped } =
      report.summary;
    expect(converted + approximated + htmlFallback + skipped).toBe(total);
  });
});

describe("convertHtmlTemplate — a heading a cell's wrapper div hides", () => {
  // The shape mjml@5 compiles an `mj-text` into: the cell holds a plain <div>
  // carrying the visual properties, and that div's whole content is the one
  // block-level element. Reached through the cell walk rather than
  // `convertElement` directly, so this is the seam the block mapper's unwrap
  // has to hold across.
  const html = `<html><body><table><tr><td>
    <div style="font-family:Georgia, serif;font-size:22px;text-align:center;color:#ff0000">
      <h3 style="margin:0;font-size:inherit;color:inherit">Cell heading</h3>
    </div>
    <div style="font-size:14px"><p>Cell copy.</p></div>
  </td></tr></table></body></html>`;

  const result = convertHtmlTemplate(html);

  it("types the heading and keeps the copy beside it", () => {
    const section = result.content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.children[0].map((block) => block.type)).toEqual([
      "title",
      "paragraph",
    ]);
  });

  it("keeps the level and the wrapper's styling on the title", () => {
    const title = findBlock(result.content.blocks, "title")!;
    expect(title.level).toBe(3);
    expect(title.content).toBe("<p>Cell heading</p>");
    expect(title.color).toBe("#ff0000");
    expect(title.textAlign).toBe("center");
    expect(title.fontFamily).toBe("Georgia");
  });

  it("names the elements the blocks came from in the report", () => {
    expect(
      result.report.entries.map((entry) => [
        entry.sourceTag,
        entry.templaticalBlockType,
      ]),
    ).toEqual([
      ["h3", "title"],
      // The wrapped <p> keeps its container mapping — see the `p` exclusion in
      // the block mapper's unwrap set.
      ["div", "paragraph"],
      ["tr", "section"],
    ]);
    expect(result.report.warnings).toEqual([]);
  });
});

/**
 * The blocks a template's single synthetic section holds, for the loose-content
 * cases below. Fails loudly rather than returning an empty list, so a case that
 * produced no section cannot pass by asserting on nothing.
 */
function soleSectionBlocks(blocks: Block[]): Block[] {
  if (blocks.length !== 1 || blocks[0].type !== "section") {
    throw new Error(
      `expected exactly one section, got ${JSON.stringify(blocks.map((b) => b.type))}`,
    );
  }
  const section = blocks[0] as SectionBlock;
  if (section.children.length !== 1) {
    throw new Error(`expected one column, got ${section.children.length}`);
  }
  return section.children[0];
}

describe("convertHtmlTemplate — bare text at body level", () => {
  const html = `<!doctype html><html><body>Lead copy<h2>Heading</h2>Trailing copy</body></html>`;
  const { content, report } = convertHtmlTemplate(html);

  it("keeps the copy on either side of a heading", () => {
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual([
      "paragraph",
      "title",
      "paragraph",
    ]);
    expect(
      leaves.map((block) => ("content" in block ? block.content : "")),
    ).toEqual(["<p>Lead copy</p>", "<p>Heading</p>", "<p>Trailing copy</p>"]);
  });

  it("names body as the source of each bare run", () => {
    expect(
      report.entries.map((entry) => [
        entry.sourceTag,
        entry.templaticalBlockType,
        entry.status,
      ]),
    ).toEqual([
      ["body", "paragraph", "converted"],
      ["h2", "title", "converted"],
      ["body", "paragraph", "converted"],
      ["body", "section", "converted"],
    ]);
    expect(report.warnings).toEqual([]);
  });

  it("groups consecutive inline nodes into one paragraph", () => {
    const { content: grouped } = convertHtmlTemplate(
      `<!doctype html><html><body>First <strong>bold</strong> last<h2>H</h2></body></html>`,
    );
    const leaves = soleSectionBlocks(grouped.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["paragraph", "title"]);
    expect("content" in leaves[0] ? leaves[0].content : "").toBe(
      "<p>First <strong>bold</strong> last</p>",
    );
  });

  it("imports a body of nothing but copy, instead of reporting no content", () => {
    // The coarsest form of the defect: an element-only walk finds nothing in
    // this body, so the report claims the email has no convertible content —
    // a false statement about a template whose every word is visible.
    const { content, report } = convertHtmlTemplate("Just some copy");
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["paragraph"]);
    expect("content" in leaves[0] ? leaves[0].content : "").toBe(
      "<p>Just some copy</p>",
    );
    expect(report.warnings).toEqual([]);
  });

  it("styles a bare run from the body's own declarations", () => {
    // Off the paragraph factory's defaults on both axes: `#1a1a1a` is the
    // colour `buildParagraph` treats as unset, and 16px is the size it drops.
    const { content: styled } = convertHtmlTemplate(
      `<!doctype html><html><body style="color: #0b5cff; font-size: 22px">Bare copy</body></html>`,
    );
    const leaves = soleSectionBlocks(styled.blocks);

    expect(leaves).toHaveLength(1);
    const paragraph = leaves[0];
    expect(paragraph.type).toBe("paragraph");
    const inner = "content" in paragraph ? String(paragraph.content) : "";
    expect(inner).toContain("font-size: 22px");
    expect(inner).toContain("color: #0b5cff");
    expect(inner).toContain("Bare copy");
  });
});

describe("convertHtmlTemplate — bare text inside a layout container", () => {
  const html = `<!doctype html><html><body>
    <div>Lead copy<table role="presentation"><tr><td><p>Cell copy</p></td></tr></table></div>
  </body></html>`;
  const { content, report } = convertHtmlTemplate(html);

  it("keeps the copy sitting before the container's table", () => {
    expect(content.blocks.map((block) => block.type)).toEqual([
      "section",
      "section",
    ]);

    const loose = (content.blocks[0] as SectionBlock).children[0];
    expect(loose.map((block) => block.type)).toEqual(["paragraph"]);
    expect("content" in loose[0] ? loose[0].content : "").toBe(
      "<p>Lead copy</p>",
    );

    const inner = (content.blocks[1] as SectionBlock).children[0];
    expect(inner.map((block) => block.type)).toEqual(["paragraph"]);
    expect("content" in inner[0] ? inner[0].content : "").toBe(
      "<p>Cell copy</p>",
    );
  });

  it("names the container as the source of the bare run", () => {
    expect(
      report.entries.map((entry) => [
        entry.sourceTag,
        entry.templaticalBlockType,
      ]),
    ).toEqual([
      ["div", "paragraph"],
      ["body", "section"],
      ["p", "paragraph"],
      ["tr", "section"],
    ]);
    expect(report.warnings).toEqual([]);
  });

  it("does not merge a run across the container boundary", () => {
    // Text outside the container and text inside it are different lines, so
    // each keeps its own block. A run shared across levels would splice
    // "Outside" and "Inside" into one paragraph.
    const { content: split } = convertHtmlTemplate(
      `<!doctype html><html><body>Outside<div>Inside<table role="presentation"><tr><td><p>Cell</p></td></tr></table></div></body></html>`,
    );
    const contents = JSON.stringify(split.blocks);

    expect(contents).toContain("<p>Outside</p>");
    expect(contents).toContain("<p>Inside</p>");
    expect(contents).not.toContain("OutsideInside");
  });
});

describe("convertHtmlTemplate — a plain anchor at body or container level", () => {
  it("keeps the href of an anchor that is a direct child of body", () => {
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body><a href="https://example.com/pricing">See pricing</a></body></html>`,
    );
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["paragraph"]);
    expect("content" in leaves[0] ? leaves[0].content : "").toBe(
      '<p><a href="https://example.com/pricing">See pricing</a></p>',
    );
    expect(
      report.entries.map((entry) => [
        entry.sourceTag,
        entry.templaticalBlockType,
        entry.status,
      ]),
    ).toEqual([
      ["body", "paragraph", "converted"],
      ["body", "section", "converted"],
    ]);
    expect("note" in report.entries[0]).toBe(false);
  });

  it("keeps the href of an anchor that is a direct child of a container", () => {
    const { content } = convertHtmlTemplate(
      `<!doctype html><html><body><div><a href="https://example.com/docs">Read the docs</a><table role="presentation"><tr><td><p>Cell</p></td></tr></table></div></body></html>`,
    );
    const loose = (content.blocks[0] as SectionBlock).children[0];

    expect(loose.map((block) => block.type)).toEqual(["paragraph"]);
    expect("content" in loose[0] ? loose[0].content : "").toBe(
      '<p><a href="https://example.com/docs">Read the docs</a></p>',
    );
  });

  it("keeps a styled anchor at body level a button", () => {
    // The prose-anchor fold must not swallow a call to action: the same
    // `looksLikeButton` test the cell walk uses decides it.
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body><a href="https://example.com/buy" style="display: inline-block; background-color: #0b5cff; padding: 14px 28px; color: #ffffff">Buy now</a></body></html>`,
    );
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["button"]);
    const button = leaves[0];
    expect(button.type === "button" && button.url).toBe(
      "https://example.com/buy",
    );
    expect(button.type === "button" && button.text).toBe("Buy now");
    expect(button.type === "button" && button.backgroundColor).toBe("#0b5cff");
    expect(
      report.entries.map((entry) => [
        entry.sourceTag,
        entry.templaticalBlockType,
      ]),
    ).toEqual([
      ["a", "button"],
      ["body", "section"],
    ]);
  });
});

describe("convertHtmlTemplate — what a bare-text walk must NOT create", () => {
  it("keeps warning that a body of whitespace alone has no content", () => {
    // The bare-text walk must not turn incidental markup into content: a
    // template whose body holds only whitespace, a comment, an `&nbsp;` or a
    // `<br>` still imports as nothing, and still says so.
    for (const body of [
      "   \n  ",
      "<!-- only a comment -->",
      "&nbsp;&nbsp;",
      "<br><br>",
    ]) {
      const { content, report } = convertHtmlTemplate(
        `<!doctype html><html><body>${body}</body></html>`,
      );
      expect(content.blocks).toEqual([]);
      expect(
        report.warnings.some((warning) =>
          warning.includes("No convertible content"),
        ),
      ).toBe(true);
    }
  });

  it("emits no paragraph for whitespace between two elements", () => {
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body><h2>A</h2>\n   \n<h2>B</h2></body></html>`,
    );
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["title", "title"]);
    expect(report.entries.map((entry) => entry.templaticalBlockType)).toEqual([
      "title",
      "title",
      "section",
    ]);
  });

  it("does not let a comment split one line into two paragraphs", () => {
    const { content } = convertHtmlTemplate(
      `<!doctype html><html><body>One <!-- merge tag --> two<h2>H</h2></body></html>`,
    );
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["paragraph", "title"]);
    expect("content" in leaves[0] ? leaves[0].content : "").toBe(
      "<p>One  two</p>",
    );
  });

  it("emits no paragraph for a comment carrying no text beside it", () => {
    const { content, report } = convertHtmlTemplate(
      `<!doctype html><html><body><!-- lonely --><h2>Only heading</h2></body></html>`,
    );
    const leaves = soleSectionBlocks(content.blocks);

    expect(leaves.map((block) => block.type)).toEqual(["title"]);
    expect(report.summary).toEqual({
      total: 2,
      converted: 2,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("still makes a body-level table a section, in source order around loose text", () => {
    const { content } = convertHtmlTemplate(
      `<!doctype html><html><body>Before<table role="presentation"><tr><td><p>Cell copy</p></td></tr></table>After</body></html>`,
    );

    expect(content.blocks.map((block) => block.type)).toEqual([
      "section",
      "section",
      "section",
    ]);
    expect(
      content.blocks.map((block) =>
        (block as SectionBlock).children[0].map((leaf) =>
          "content" in leaf ? leaf.content : leaf.type,
        ),
      ),
    ).toEqual([["<p>Before</p>"], ["<p>Cell copy</p>"], ["<p>After</p>"]]);
  });

  it("leaves a container holding only a table reading its real column count", () => {
    // The container descent stays gated on `declaresColumnsBelow`: relaxing it
    // shatters a section into one section per block wherever a single cell
    // holds one container per column.
    const { content } = convertHtmlTemplate(
      `<!doctype html><html><body><div><table role="presentation"><tr>
        <td width="300"><p>Left copy</p></td><td width="300"><p>Right copy</p></td>
      </tr></table></div></body></html>`,
    );

    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("2");
    expect(
      section.children.map((column) =>
        column.map((leaf) => ("content" in leaf ? leaf.content : leaf.type)),
      ),
    ).toEqual([["<p>Left copy</p>"], ["<p>Right copy</p>"]]);
  });
});
