// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  type CustomBlockDefinition,
  type TemplateContent,
} from "@templatical/types";
import { useBlockRegistry } from "../src/composables/useBlockRegistry";
import { useCustomBlockStylesheets } from "../src/composables/useCustomBlockStylesheets";

/**
 * Composable that drives the editor's `<CustomBlockStylesheets>` mirror.
 * Mirrors the renderer's `collectCustomBlockStylesheets` contract: dedupe by
 * customType *and* by trimmed content, skip empty/missing, walk into sections.
 */

const STACK_CSS = `
@media (max-width: 480px) {
  .tplc-image-text { display: block !important; }
}
`;
const HOVER_CSS = `.tplc-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }`;

function makeRegistry() {
  const registry = useBlockRegistry();
  return registry;
}

function registerDef(
  registry: ReturnType<typeof useBlockRegistry>,
  type: string,
  stylesheet?: string,
) {
  const def: CustomBlockDefinition = {
    type,
    name: type,
    fields: [],
    template: `<div class="tplc-${type}">x</div>`,
    ...(stylesheet === undefined ? {} : { stylesheet }),
  };
  registry.registerCustom(def, defineComponent({ render: () => h("div") }));
  return def;
}

describe("useCustomBlockStylesheets", () => {
  it("returns empty when no custom blocks are present", () => {
    const registry = makeRegistry();
    registerDef(registry, "image-text", STACK_CSS);
    const content = ref<TemplateContent>(createDefaultTemplateContent());

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toEqual([]);
  });

  it("returns the stylesheet for a present customType", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "image-text", STACK_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(1);
    expect(sheets.value[0]).toContain(".tplc-image-text");
  });

  it("dedupes across multiple instances of the same customType", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "image-text", STACK_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [
      createCustomBlock(def),
      createCustomBlock(def),
      createCustomBlock(def),
    ];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(1);
  });

  it("dedupes by trimmed content when two definitions share CSS", () => {
    const registry = makeRegistry();
    const a = registerDef(registry, "a", STACK_CSS);
    const b = registerDef(registry, "b", STACK_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(a), createCustomBlock(b)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(1);
  });

  it("emits both stylesheets when two definitions ship different CSS", () => {
    const registry = makeRegistry();
    const a = registerDef(registry, "a", STACK_CSS);
    const b = registerDef(registry, "b", HOVER_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(a), createCustomBlock(b)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(2);
    expect(sheets.value.some((s) => s.includes(".tplc-image-text"))).toBe(true);
    expect(sheets.value.some((s) => s.includes(".tplc-card:hover"))).toBe(true);
  });

  it("skips definitions with no stylesheet field", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "no-styles"); // no stylesheet

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toEqual([]);
  });

  it("skips whitespace-only stylesheets", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "blank", "  \n\t  ");

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toEqual([]);
  });

  it("walks into sections to collect nested custom-block types", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "image-text", STACK_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [
      createSectionBlock({
        columns: "2",
        children: [[createCustomBlock(def)], [createParagraphBlock()]],
      }),
    ];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(1);
    expect(sheets.value[0]).toContain(".tplc-image-text");
  });

  it("updates reactively when a custom block is added", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "image-text", STACK_CSS);

    const content = ref(createDefaultTemplateContent());
    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toEqual([]);

    content.value = {
      ...content.value,
      blocks: [createCustomBlock(def)],
    };
    expect(sheets.value).toHaveLength(1);
  });

  it("updates reactively when the last instance of a customType is removed", () => {
    const registry = makeRegistry();
    const def = registerDef(registry, "image-text", STACK_CSS);

    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(content, registry);
    expect(sheets.value).toHaveLength(1);

    content.value = { ...content.value, blocks: [] };
    expect(sheets.value).toEqual([]);
  });
});
