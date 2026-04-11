import "./dom-stubs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerBuiltInBlocks } from "../src/utils/registerBuiltInBlocks";
import { useBlockRegistry } from "../src/composables/useBlockRegistry";

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

describe("registerBuiltInBlocks (behavioral)", () => {
  const ALL_BLOCK_TYPES = [
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

  function makeDummyComponent(name: string) {
    return { name, render: () => null } as any;
  }

  function makeFullComponentMap(): Record<string, any> {
    const map: Record<string, any> = {};
    for (const type of ALL_BLOCK_TYPES) {
      map[type] = makeDummyComponent(type);
    }
    return map;
  }

  it("registers all 13 block types when all components are provided", () => {
    const registry = useBlockRegistry();
    const componentMap = makeFullComponentMap();

    registerBuiltInBlocks(registry, componentMap);

    for (const type of ALL_BLOCK_TYPES) {
      expect(registry.isRegistered(type)).toBe(true);
    }
    expect(registry.getSidebarItems()).toHaveLength(13);
  });

  it("each registered block creates a block with the correct type", () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    for (const type of ALL_BLOCK_TYPES) {
      const block = registry.createBlock(type);
      expect(block).not.toBeUndefined();
      // section creates a section block, etc.
      expect(block!.type).toBe(type);
    }
  });

  it("each registered block resolves to the correct component", () => {
    const registry = useBlockRegistry();
    const componentMap = makeFullComponentMap();
    registerBuiltInBlocks(registry, componentMap);

    for (const type of ALL_BLOCK_TYPES) {
      const block = { id: "test", type } as any;
      expect(registry.getComponent(block)).toBe(componentMap[type]);
    }
  });

  it("all sidebar items are marked as isCustom: false", () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    const items = registry.getSidebarItems();
    for (const item of items) {
      expect(item.isCustom).toBe(false);
    }
  });

  it("each sidebar item has a non-empty label", () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    const items = registry.getSidebarItems();
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("skips block types that have no matching component in the map", () => {
    const registry = useBlockRegistry();
    // Only provide components for 3 types
    const partialMap: Record<string, any> = {
      title: makeDummyComponent("title"),
      image: makeDummyComponent("image"),
      button: makeDummyComponent("button"),
    };

    registerBuiltInBlocks(registry, partialMap);

    expect(registry.isRegistered("title")).toBe(true);
    expect(registry.isRegistered("image")).toBe(true);
    expect(registry.isRegistered("button")).toBe(true);
    expect(registry.isRegistered("section")).toBe(false);
    expect(registry.isRegistered("paragraph")).toBe(false);
    expect(registry.isRegistered("divider")).toBe(false);
    expect(registry.getSidebarItems()).toHaveLength(3);
  });

  it("registers nothing when given an empty component map", () => {
    const registry = useBlockRegistry();

    registerBuiltInBlocks(registry, {});

    expect(registry.getSidebarItems()).toHaveLength(0);
    for (const type of ALL_BLOCK_TYPES) {
      expect(registry.isRegistered(type)).toBe(false);
    }
  });

  it("calls registerBuiltIn on the registry (spy verification)", () => {
    const registry = useBlockRegistry();
    const spy = vi.spyOn(registry, "registerBuiltIn");

    registerBuiltInBlocks(registry, makeFullComponentMap());

    expect(spy).toHaveBeenCalledTimes(13);
    for (const call of spy.mock.calls) {
      expect(ALL_BLOCK_TYPES).toContain(call[0]);
      expect(call[1]).toHaveProperty("component");
      expect(call[1]).toHaveProperty("createBlock");
      expect(call[1]).toHaveProperty("sidebarItem");
    }
  });
});
