import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

describe("registerBuiltInBlocks utility", () => {
  const src = readSrc("utils/registerBuiltInBlocks.ts");

  it("defines all 13 built-in block types (section excluded from custom, but included)", () => {
    const expectedTypes = [
      "section",
      "title",
      "paragraph",
      "image",
      "button",
      "divider",
      "video",
      "social",
      "menu",
      "table",
      "spacer",
      "html",
      "countdown",
    ];
    for (const type of expectedTypes) {
      expect(src).toContain(`type: "${type}"`);
    }
  });

  it("imports all factory functions from @templatical/types", () => {
    const factories = [
      "createSectionBlock",
      "createTitleBlock",
      "createParagraphBlock",
      "createImageBlock",
      "createButtonBlock",
      "createDividerBlock",
      "createVideoBlock",
      "createSocialIconsBlock",
      "createMenuBlock",
      "createTableBlock",
      "createSpacerBlock",
      "createHtmlBlock",
      "createCountdownBlock",
    ];
    for (const factory of factories) {
      expect(src).toContain(factory);
    }
  });

  it("calls registry.registerBuiltIn for each block type with matching component", () => {
    expect(src).toContain("registry.registerBuiltIn(def.type");
    expect(src).toContain("componentMap[def.type]");
  });

  it("marks all sidebar items as isCustom: false", () => {
    expect(src).toContain("isCustom: false");
    expect(src).not.toContain("isCustom: true");
  });

  it("defines exactly 13 built-in block types", () => {
    const typeMatches = src.match(/type: "/g);
    expect(typeMatches).toHaveLength(13);
  });
});

describe("registerBuiltInBlocks consumers", () => {
  it("useEditorCore calls registerBuiltInBlocks", () => {
    const src = readSrc("composables/useEditorCore.ts");
    expect(src).toContain("registerBuiltInBlocks(registry, BLOCK_COMPONENT_MAP)");
    expect(src).toContain(
      'import { registerBuiltInBlocks } from "../utils/registerBuiltInBlocks"',
    );
  });

  it("Editor.vue delegates to useEditorCore", () => {
    const src = readSrc("Editor.vue");
    expect(src).toContain("useEditorCore(");
    expect(src).not.toContain("registerBuiltInBlocks(");
  });

  it("CloudEditor.vue delegates to useEditorCore (no direct registerBuiltInBlocks call)", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("useEditorCore(");
    expect(src).not.toContain("registerBuiltInBlocks(");
  });

  it("CloudEditor.vue no longer imports factory functions directly", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).not.toContain("createSectionBlock");
    expect(src).not.toContain("createTitleBlock");
    expect(src).not.toContain("createImageBlock");
    // Block registration is handled by useEditorCore
    expect(src).toContain("useEditorCore(");
  });

  it("useEditorCore defines BLOCK_COMPONENT_MAP with all 13 block components", () => {
    const src = readSrc("composables/useEditorCore.ts");
    const expectedKeys = [
      "section: SectionBlock",
      "title: TitleBlock",
      "paragraph: ParagraphBlock",
      "image: ImageBlock",
      "button: ButtonBlock",
      "divider: DividerBlock",
      "video: VideoBlock",
      "social: SocialIconsBlock",
      "menu: MenuBlock",
      "table: TableBlock",
      "spacer: SpacerBlock",
      "html: HtmlBlock",
      "countdown: CountdownBlockComponent",
    ];
    for (const key of expectedKeys) {
      expect(src).toContain(key);
    }
  });
});
