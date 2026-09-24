// @vitest-environment happy-dom
import "./dom-stubs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
  type SectionBlock,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import SectionToolbar from "../src/components/toolbar/SectionToolbar.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { LAYOUT_KEY, SECTION_WRAPPER_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import fr from "../src/i18n/locales/fr";

const FRENCH_CONFLICT =
  "Cet éditeur encadre déjà l'e-mail. Un cadre supplémentaire sur cette section n'est pas pris en charge — l'aperçu et l'export échoueront.";

function cardLayout(): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.blocks = [createWrapperBlock({ children: [createSlotBlock()] })];
  return layout;
}

function siblingLayout(): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.blocks = [createSlotBlock()];
  return layout;
}

function framedSection(): SectionBlock {
  return createSectionBlock({
    wrapper: {
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
    },
  });
}

function mountToolbar(opts: {
  block: SectionBlock;
  layout?: TemplateContent;
  sectionWrapper?: boolean;
}) {
  const provides: Record<symbol, unknown> = {
    [TRANSLATIONS_KEY]: fr,
  };
  if (opts.layout !== undefined) {
    provides[LAYOUT_KEY] = opts.layout;
  }
  if (opts.sectionWrapper !== undefined) {
    provides[SECTION_WRAPPER_KEY] = opts.sectionWrapper;
  }
  return mountEditor(SectionToolbar, {
    props: { block: opts.block },
    provides,
    global: {
      stubs: {
        ColorPicker: true,
        SpacingControl: true,
      },
    },
  });
}

function wrapperSwitch(wrapper: VueWrapper) {
  return wrapper
    .findAll('button[role="switch"]')
    .find((b) => b.attributes("aria-label") === fr.section.wrapperEnable);
}

function switchDisabled(wrapper: VueWrapper): boolean {
  return (wrapperSwitch(wrapper)!.element as HTMLButtonElement).disabled;
}

function readSrc(path: string): string {
  return readFileSync(join(import.meta.dirname, "../src", path), "utf8");
}

describe("SectionToolbar card layout (layoutWrapsSlot)", () => {
  it("disables turning wrapper on and shows the French conflict note", () => {
    const wrapper = mountToolbar({
      block: createSectionBlock(),
      layout: cardLayout(),
    });
    expect(wrapperSwitch(wrapper)).not.toBeUndefined();
    expect(switchDisabled(wrapper)).toBe(true);
    expect(fr.section.wrapperLayoutConflict).toBe(FRENCH_CONFLICT);
    expect(wrapper.text()).toContain(FRENCH_CONFLICT);
  });

  it("keeps an already-on wrapper enabled so it can be turned off; note stays", () => {
    const wrapper = mountToolbar({
      block: framedSection(),
      layout: cardLayout(),
    });
    expect(switchDisabled(wrapper)).toBe(false);
    expect(wrapper.text()).toContain(FRENCH_CONFLICT);
  });

  it("does not disable the switch or show the note for a sibling-slot layout", () => {
    const wrapper = mountToolbar({
      block: createSectionBlock(),
      layout: siblingLayout(),
    });
    expect(switchDisabled(wrapper)).toBe(false);
    expect(wrapper.text()).not.toContain(FRENCH_CONFLICT);
  });
});

describe("SectionToolbar sectionWrapper kill-switch", () => {
  it("hides the panel when sectionWrapper is false, wrapper off, sibling layout", () => {
    const wrapper = mountToolbar({
      block: createSectionBlock(),
      layout: siblingLayout(),
      sectionWrapper: false,
    });
    expect(wrapper.text()).not.toContain(fr.section.wrapperEnable);
    expect(wrapperSwitch(wrapper)).toBeUndefined();
  });

  it("hides the panel when sectionWrapper is false, wrapper off, no layout", () => {
    const wrapper = mountToolbar({
      block: createSectionBlock(),
      sectionWrapper: false,
    });
    expect(wrapper.text()).not.toContain(fr.section.wrapperEnable);
    expect(wrapperSwitch(wrapper)).toBeUndefined();
  });

  it("keeps an already-on wrapper reachable, then hides the panel once it is off", async () => {
    const block = framedSection();
    const wrapper = mountToolbar({
      block,
      sectionWrapper: false,
    });
    expect(wrapper.text()).toContain(fr.section.wrapperEnable);
    expect(switchDisabled(wrapper)).toBe(false);

    await wrapperSwitch(wrapper)!.trigger("click");
    const payload = wrapper.emitted("update")![0][0] as Partial<SectionBlock>;
    expect(payload.wrapper).toBeUndefined();

    await wrapper.setProps({ block: { ...block, wrapper: undefined } });
    expect(wrapper.text()).not.toContain(fr.section.wrapperEnable);
    expect(wrapperSwitch(wrapper)).toBeUndefined();
  });

  it("shows the panel when sectionWrapper is omitted", () => {
    const wrapper = mountToolbar({ block: createSectionBlock() });
    expect(wrapper.text()).toContain(fr.section.wrapperEnable);
    expect(switchDisabled(wrapper)).toBe(false);
  });

  it("shows the panel when sectionWrapper is true", () => {
    const wrapper = mountToolbar({
      block: createSectionBlock(),
      sectionWrapper: true,
    });
    expect(wrapper.text()).toContain(fr.section.wrapperEnable);
    expect(switchDisabled(wrapper)).toBe(false);
  });
});

describe("config.sectionWrapper reaches SectionToolbar through Editor.vue", () => {
  let editor: VueWrapper | undefined;

  afterEach(() => {
    editor?.unmount();
    editor = undefined;
  });

  async function mountRealEditor(config: Record<string, unknown> = {}) {
    const translations = await loadTranslations("en");
    const section = createSectionBlock();
    const content = createDefaultTemplateContent();
    content.blocks = [section];
    const wrapper = mount(Editor, {
      props: {
        config: {
          container: document.createElement("div"),
          content,
          ...config,
        },
        translations,
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true } },
    });
    await wrapper.get(`[data-block-id="${section.id}"]`).trigger("click");
    // Toolbar is defineAsyncComponent. Its import graph is the whole
    // properties panel, so a single nextTick returns before it renders.
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="block-toolbar"]').exists()).toBe(
          true,
        );
      },
      { timeout: 10_000 },
    );
    return { wrapper, translations };
  }

  it("hides Add wrapper when config.sectionWrapper is false and the section has none", async () => {
    const mounted = await mountRealEditor({ sectionWrapper: false });
    editor = mounted.wrapper;
    expect(editor.text()).toContain(mounted.translations.section.columns);
    expect(editor.text()).not.toContain(
      mounted.translations.section.wrapperEnable,
    );
  });

  it("Editor.vue forwards config.sectionWrapper into useEditorCore", () => {
    expect(readSrc("Editor.vue")).toContain(
      "sectionWrapper: props.config.sectionWrapper",
    );
  });

  it("initCloud forwards config.sectionWrapper into the init() config", () => {
    expect(readSrc("index.ts")).toContain(
      "sectionWrapper: config.sectionWrapper",
    );
  });

  it("useEditorCore provides SECTION_WRAPPER_KEY from config.sectionWrapper", () => {
    const src = readSrc("composables/useEditorCore.ts");
    expect(src).toContain("SECTION_WRAPPER_KEY");
    expect(src).toContain("config.sectionWrapper");
    expect(src).toContain(
      "provide(SECTION_WRAPPER_KEY, config.sectionWrapper)",
    );
  });

  it("both public config types expose sectionWrapper", () => {
    expect(readSrc("index.ts")).toContain("sectionWrapper?: boolean");
    expect(readSrc("cloud/cloudConfig.ts")).toContain(
      "sectionWrapper?: boolean",
    );
  });

  it("keys.ts declares SECTION_WRAPPER_KEY separately from LAYOUT_KEY", () => {
    const src = readSrc("keys.ts");
    expect(src).toContain("export const SECTION_WRAPPER_KEY");
    expect(src).toContain('Symbol("sectionWrapper")');
    expect(src).toContain("export const LAYOUT_KEY");
  });
});
