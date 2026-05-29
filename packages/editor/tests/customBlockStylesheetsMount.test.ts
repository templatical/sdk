// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { computed, defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  type CustomBlockDefinition,
} from "@templatical/types";
import CustomBlockStylesheets from "../src/components/CustomBlockStylesheets.vue";
import { useBlockRegistry } from "../src/composables/useBlockRegistry";
import { useCustomBlockStylesheets } from "../src/composables/useCustomBlockStylesheets";
import { CUSTOM_BLOCK_STYLESHEETS_KEY } from "../src/keys";

/**
 * Bridge tests between `useCustomBlockStylesheets` (composable) and the
 * actual DOM. The composable's correctness is unit-tested elsewhere; this
 * file proves the data flows through the inject layer and into rendered
 * `<style>` elements that consumers see in the canvas — the bug class
 * unit tests of either side in isolation cannot catch.
 */

function dummyComponent() {
  return defineComponent({ render: () => h("div") });
}

function registerDef(
  registry: ReturnType<typeof useBlockRegistry>,
  def: CustomBlockDefinition,
) {
  registry.registerCustom(def, dummyComponent());
  return def;
}

describe("CustomBlockStylesheets mount contract", () => {
  it("renders one <style data-tpl-custom-block-stylesheet> per injected entry", () => {
    const stylesheets = computed(() => [
      ".tplc-a { color: red; }",
      "@media (max-width: 480px) { .tplc-b { display: block; } }",
      ".tplc-c:hover { opacity: 0.8; }",
    ]);

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });

    const tags = wrapper.findAll("style[data-tpl-custom-block-stylesheet]");
    expect(tags).toHaveLength(3);
    // innerHTML, not textContent — `v-html` must set innerHTML on a `<style>`
    // element so the browser parses the rules; textContent would render the
    // CSS as a text node and fail at runtime.
    expect(tags[0].element.innerHTML).toContain(".tplc-a { color: red; }");
    expect(tags[1].element.innerHTML).toContain("@media (max-width: 480px)");
    expect(tags[1].element.innerHTML).toContain(".tplc-b");
    expect(tags[2].element.innerHTML).toContain(".tplc-c:hover");
  });

  it("renders nothing when no parent provides the inject key", () => {
    const wrapper = mount(CustomBlockStylesheets);
    expect(wrapper.find("style").exists()).toBe(false);
  });

  it("renders nothing when the injected list is empty", () => {
    const stylesheets = computed<string[]>(() => []);
    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });
    expect(wrapper.find("style").exists()).toBe(false);
  });

  it("re-renders the <style> set when the injected list changes", async () => {
    const list = ref<string[]>([]);
    const stylesheets = computed(() => list.value);

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });
    expect(wrapper.findAll("style").length).toBe(0);

    list.value = [".tplc-late { padding: 8px; }"];
    await nextTick();
    expect(wrapper.findAll("style").length).toBe(1);
    expect(wrapper.find("style").element.innerHTML).toContain(
      ".tplc-late { padding: 8px; }",
    );

    list.value = [];
    await nextTick();
    expect(wrapper.findAll("style").length).toBe(0);
  });
});

describe("End-to-end: registry → composable → DOM <style> tag", () => {
  it("emits a <style> tag in the canvas when a custom block with a stylesheet is added", async () => {
    const registry = useBlockRegistry();
    const def = registerDef(registry, {
      type: "image-text",
      name: "Image+Text",
      fields: [],
      template: "<div>x</div>",
      stylesheet: ".tplc-image-text-cell { display: block !important; }",
    });

    const content = ref(createDefaultTemplateContent());
    const stylesheets = useCustomBlockStylesheets(content, registry);

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });

    // Empty template → no stylesheet emitted.
    expect(wrapper.findAll("style").length).toBe(0);

    // Add an instance of the registered type → stylesheet appears in DOM.
    content.value = {
      ...content.value,
      blocks: [createCustomBlock(def)],
    };
    await nextTick();

    const tags = wrapper.findAll("style[data-tpl-custom-block-stylesheet]");
    expect(tags).toHaveLength(1);
    expect(tags[0].element.innerHTML).toContain(
      ".tplc-image-text-cell { display: block !important; }",
    );

    // Remove the block → stylesheet disappears.
    content.value = { ...content.value, blocks: [] };
    await nextTick();
    expect(wrapper.findAll("style").length).toBe(0);
  });
});

describe("Block registry — stylesheet lookup path", () => {
  // The editor's `defineExpose.getCustomBlockStylesheet` and the
  // `TemplaticalEditor` instance literal both delegate to
  // `registry.getDefinition(customType)?.stylesheet`. These cases lock the
  // three branches of that lookup; the source-pattern assertion below pins
  // the wiring so a future refactor of the expose line surfaces here.
  it("returns the registered definition's stylesheet for known types", () => {
    const registry = useBlockRegistry();
    registerDef(registry, {
      type: "hero",
      name: "Hero",
      fields: [],
      template: "<div>h</div>",
      stylesheet: ".tplc-hero { padding: 32px; }",
    });
    expect(registry.getDefinition("hero")?.stylesheet).toBe(
      ".tplc-hero { padding: 32px; }",
    );
  });

  it("returns undefined for unknown customTypes", () => {
    const registry = useBlockRegistry();
    expect(registry.getDefinition("never-registered")?.stylesheet).toBe(
      undefined,
    );
  });

  it("returns undefined for definitions without a stylesheet field", () => {
    const registry = useBlockRegistry();
    registerDef(registry, {
      type: "plain",
      name: "Plain",
      fields: [],
      template: "<div>p</div>",
    });
    expect(registry.getDefinition("plain")?.stylesheet).toBe(undefined);
  });
});

describe("Editor.vue — getCustomBlockStylesheet expose wiring (source pattern)", () => {
  // Editor.vue is heavy to mount (needs config, fontsManager, translations,
  // etc.). Mounting it for one expose line isn't worth the rig. Instead we
  // pin the exact line via source inspection — same pattern as
  // `block-chrome-structure.test.ts`. Refactoring this expose is fine; the
  // test fails until the new wiring is locked in here too. That paper trail
  // is the point.
  const editorSrc = readFileSync(
    join(import.meta.dirname, "..", "src", "Editor.vue"),
    "utf8",
  );

  it("Editor.vue exposes getCustomBlockStylesheet routing through registry.getDefinition().stylesheet", () => {
    expect(editorSrc).toMatch(
      /getCustomBlockStylesheet:\s*\(customType:\s*string\)\s*=>\s*[\s\S]*?core\.registry\.getDefinition\(customType\)\?\.stylesheet/,
    );
  });
});
