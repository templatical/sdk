import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import {
  createButtonBlock,
  createMenuBlock,
  createParagraphBlock,
  createTableBlock,
  createTitleBlock,
} from "@templatical/types";
import { RenderContext, renderBlock } from "../src";

type Compiler = (source: string) => Promise<{ html: string; errors: unknown[] }>;

function resolveCompiler(value: unknown): Compiler | undefined {
  if (typeof value === "function") return value as Compiler;
  if (!value || typeof value !== "object") return undefined;
  const record = value as { default?: unknown; mjml?: unknown };
  return resolveCompiler(record.default) ?? resolveCompiler(record.mjml);
}

const browserCompiler: Promise<Compiler> = import("mjml-browser").then((mod) => {
  const compiler = resolveCompiler(mod);
  if (!compiler) throw new Error("mjml-browser did not export a compiler");
  return compiler;
});

const context = new RenderContext(600, [], "Arial, sans-serif", true);
const menuItem = { id: "i", text: "Item", url: "/", openInNewTab: false, bold: false, underline: false };
const cases = [
  ["paragraph", createParagraphBlock({ content: '<p style="line-height:1.8">Text</p>' }), "25.2px"],
  ["title", createTitleBlock({ content: "<p>Title</p>", level: 2 }), "36.4px"],
  ["menu", createMenuBlock({ items: [menuItem], fontSize: 14 }), "21px"],
  ["table", createTableBlock({ rows: [{ id: "r", cells: [{ id: "c", content: "Cell" }] }], fontSize: 14 }), "21px"],
  ["button", createButtonBlock({ text: "Button", fontSize: 14, lineHeight: 1.8 }), "25.2px"],
] as const;

describe.each([
  ["mjml", async () => nodeMjml as Compiler],
  ["mjml-browser", async () => browserCompiler],
] as const)("Outlook line height in compiled HTML via %s", (_name, getCompiler) => {
  it.each(cases)("keeps the %s declaration", async (name, block, expected) => {
    const source = `<mjml><mj-body><mj-section><mj-column>${renderBlock(block, context)}</mj-column></mj-section></mj-body></mjml>`;
    const compiler = await getCompiler();
    const result = await compiler(source);
    expect(result.errors).toEqual([]);
    expect(result.html).toContain(`mso-line-height-alt:${expected}`);
    if (name === "paragraph") {
      expect(result.html).toMatch(/<p\b[^>]*mso-line-height-alt:25\.2px/);
    }
    if (name === "button") {
      expect(result.html).toMatch(/<span\b[^>]*mso-line-height-alt:25\.2px/);
    }
  });
});
