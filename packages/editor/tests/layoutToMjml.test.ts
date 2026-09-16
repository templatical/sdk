import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
  type Block,
  type TemplateContent,
} from "@templatical/types";
import { toMjmlForInstance } from "../src/utils/toMjml";

/**
 * `toMjmlForInstance` composes `getLayout()` via the renderer. Public
 * `getContent()` stays the unshelled template — a render must not write the
 * shell into that object.
 */

const NESTED_MJ_WRAPPER =
  "[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)";

const VIEW_IN_BROWSER = "VIEW-IN-BROWSER";
const AUTHOR = "AUTHOR-BODY";
const IMPRESSUM = "IMPRESSUM";

function withBlocks(
  blocks: Block[],
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  if (settings) {
    content.settings = { ...content.settings, ...settings };
  }
  return content;
}

function siblingLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createParagraphBlock({ content: `<p>${VIEW_IN_BROWSER}</p>` }),
      createSlotBlock(),
      createParagraphBlock({ content: `<p>${IMPRESSUM}</p>` }),
    ],
    settings,
  );
}

function cardLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createParagraphBlock({ content: `<p>${VIEW_IN_BROWSER}</p>` }),
      createWrapperBlock({
        styles: {
          backgroundColor: "#ffffff",
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
        borderRadius: 12,
        children: [createSlotBlock()],
      }),
      createParagraphBlock({ content: `<p>${IMPRESSUM}</p>` }),
    ],
    settings,
  );
}

function authorContent(): TemplateContent {
  return withBlocks([createParagraphBlock({ content: `<p>${AUTHOR}</p>` })], {
    backgroundColor: "#111111",
    width: 480,
  });
}

function source(content: TemplateContent, layout?: TemplateContent) {
  return {
    getContent: () => content,
    renderCustomBlock: async () => "",
    ...(layout ? { getLayout: () => layout } : {}),
  };
}

describe("toMjmlForInstance layout compose", () => {
  it("sibling layout emits chrome and layout body background without mutating getContent", async () => {
    const content = authorContent();
    const before = JSON.stringify(content);

    const mjml = await toMjmlForInstance(
      source(content, siblingLayout({ backgroundColor: "#f3f4f6" })),
    );

    expect(mjml).toContain(VIEW_IN_BROWSER);
    expect(mjml).toContain(AUTHOR);
    expect(mjml).toContain(IMPRESSUM);
    expect(mjml.indexOf(VIEW_IN_BROWSER)).toBeLessThan(mjml.indexOf(AUTHOR));
    expect(mjml.indexOf(AUTHOR)).toBeLessThan(mjml.indexOf(IMPRESSUM));
    expect(mjml).toContain(
      '<mj-body width="480px" background-color="#f3f4f6">',
    );
    expect(JSON.stringify(content)).toBe(before);
    expect(content.settings.backgroundColor).toBe("#111111");
    expect(content.blocks).toHaveLength(1);
  });

  it("without getLayout does not emit layout chrome", async () => {
    const mjml = await toMjmlForInstance(source(authorContent()));

    expect(mjml).toContain(AUTHOR);
    expect(mjml).not.toContain(VIEW_IN_BROWSER);
    expect(mjml).not.toContain(IMPRESSUM);
    expect(mjml).toContain(
      '<mj-body width="480px" background-color="#111111">',
    );
    expect(mjml).not.toContain("<mj-wrapper");
  });

  it("card layout emits mj-wrapper around author content", async () => {
    const mjml = await toMjmlForInstance(
      source(authorContent(), cardLayout({ backgroundColor: "#f3f4f6" })),
    );

    expect(mjml).toContain("<mj-wrapper");
    expect(mjml).toContain("</mj-wrapper>");
    const wrapperOpen = mjml.indexOf("<mj-wrapper");
    const wrapperClose = mjml.indexOf("</mj-wrapper>");
    const wrapper = mjml.slice(wrapperOpen, wrapperClose);
    expect(wrapper).toContain(AUTHOR);
    expect(wrapper).not.toContain(IMPRESSUM);
    expect(mjml.indexOf(IMPRESSUM)).toBeGreaterThan(wrapperClose);
  });

  it("rejects a card layout when content has section.wrapper", async () => {
    const content = withBlocks([
      createSectionBlock({
        wrapper: { backgroundColor: "#eeeeee" },
        children: [[createParagraphBlock({ content: `<p>${AUTHOR}</p>` })]],
      }),
    ]);
    const before = JSON.stringify(content);

    await expect(
      toMjmlForInstance(source(content, cardLayout())),
    ).rejects.toThrow(NESTED_MJ_WRAPPER);
    expect(JSON.stringify(content)).toBe(before);
  });
});

describe("init layout render wiring", () => {
  it("index.ts passes getLayout from config.layout into both render paths", () => {
    const src = readFileSync(
      new URL("../src/index.ts", import.meta.url),
      "utf8",
    );

    expect(src.match(/getLayout: \(\) => config\.layout/g)).toEqual([
      "getLayout: () => config.layout",
      "getLayout: () => config.layout",
    ]);
  });
});
