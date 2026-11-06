// @vitest-environment happy-dom
import "./dom-stubs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, h } from "vue";
import type { VueWrapper } from "@vue/test-utils";
import {
  useEditor,
  useHistory,
  useHistoryInterceptor,
} from "@templatical/core";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createTitleBlock,
  createWrapperBlock,
  type SectionBlock,
  type WrapperBlock,
} from "@templatical/types";
import BlockPreviewCanvas from "../src/components/BlockPreviewCanvas.vue";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import WrapperBlockView from "../src/components/blocks/WrapperBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import ColorPicker from "../src/components/ColorPicker.vue";
import CommonBlockSettings from "../src/components/toolbar/CommonBlockSettings.vue";
import BackgroundImageControl from "../src/components/toolbar/BackgroundImageControl.vue";
import SectionToolbar from "../src/components/toolbar/SectionToolbar.vue";
import { BLOCK_REGISTRY_KEY, LAYOUT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import {
  getSectionWrapperStyle,
  getWrapperStyle,
} from "../src/utils/blockComponentResolver";
import {
  applySectionFullWidth,
  clearSectionWrapper,
  isToggleOwnedWrapper,
  sectionFullWidthDisabled,
} from "../src/utils/sectionFullWidth";
import ca from "../src/i18n/locales/ca";
import de from "../src/i18n/locales/de";
import en from "../src/i18n/locales/en";
import es from "../src/i18n/locales/es";
import fr from "../src/i18n/locales/fr";
import ja from "../src/i18n/locales/ja";
import nl from "../src/i18n/locales/nl";
import ptBR from "../src/i18n/locales/pt-BR";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";
import type { Block } from "@templatical/types";

const BAND = "#112233";
const CONTENT = "#abcdef";
const PICKED = "#445566";
const IMAGE = "https://cdn.test/band.png";
const EDITED_IMAGE = "https://cdn.test/edited.png";
const PADDING = { top: 20, right: 20, bottom: 20, left: 20 };
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

const LOCALES = [en, de, fr, es, ca, ptBR, nl, ja];

function section(partial: Parameters<typeof createSectionBlock>[0] = {}) {
  return createSectionBlock(partial);
}

function filledSection(): SectionBlock {
  return section({
    styles: {
      backgroundColor: BAND,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    backgroundImage: createBackgroundImage(IMAGE),
  });
}

describe("applySectionFullWidth", () => {
  it("moves a section fill onto a new full-width wrapper", () => {
    const block = filledSection();
    expect(applySectionFullWidth(block, true)).toEqual({
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        backgroundImage: createBackgroundImage(IMAGE),
      },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      backgroundImage: undefined,
    });
  });

  it("moves the transparent keyword and leaves an empty colour where it is", () => {
    const transparent = section({
      styles: {
        backgroundColor: "transparent",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    expect(applySectionFullWidth(transparent, true).wrapper).toEqual({
      fullWidth: true,
      backgroundColor: "transparent",
    });

    const empty = section({
      styles: {
        backgroundColor: "",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    expect(applySectionFullWidth(empty, true)).toEqual({
      wrapper: { fullWidth: true },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      backgroundImage: undefined,
    });
  });

  it("only sets fullWidth when the section already has a wrapper", () => {
    const block = section({
      styles: {
        backgroundColor: "#abcdef",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      wrapper: {
        backgroundColor: BAND,
        padding: PADDING,
        borderRadius: 8,
      },
    });
    expect(applySectionFullWidth(block, true)).toEqual({
      wrapper: {
        backgroundColor: BAND,
        padding: PADDING,
        borderRadius: 8,
        fullWidth: true,
      },
    });
  });

  it("puts a toggle-owned fill back on the section and removes the wrapper", () => {
    const block = section({
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
    expect(isToggleOwnedWrapper(block.wrapper!)).toBe(true);
    expect(applySectionFullWidth(block, false)).toEqual({
      wrapper: undefined,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: BAND,
      },
      backgroundImage: createBackgroundImage(IMAGE),
    });
    expect(clearSectionWrapper(block)).toEqual(
      applySectionFullWidth(block, false),
    );
  });

  it("keeps a wrapper that has padding or a radius and only clears fullWidth", () => {
    const padded = section({
      styles: {
        backgroundColor: "#abcdef",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      wrapper: { fullWidth: true, backgroundColor: BAND, padding: PADDING },
    });
    expect(isToggleOwnedWrapper(padded.wrapper!)).toBe(false);
    expect(applySectionFullWidth(padded, false)).toEqual({
      wrapper: { fullWidth: false, backgroundColor: BAND, padding: PADDING },
    });
    expect(clearSectionWrapper(padded)).toEqual({ wrapper: undefined });

    const rounded = section({
      wrapper: { fullWidth: true, backgroundColor: BAND, borderRadius: 8 },
    });
    expect(applySectionFullWidth(rounded, false).wrapper).toMatchObject({
      fullWidth: false,
      borderRadius: 8,
      backgroundColor: BAND,
    });
  });

  it("is not toggle-owned unless full width is on", () => {
    expect(isToggleOwnedWrapper({ backgroundColor: BAND })).toBe(false);
    expect(
      isToggleOwnedWrapper({ fullWidth: false, backgroundColor: BAND }),
    ).toBe(false);
  });

  it("does nothing when full width turns off and the section has no wrapper", () => {
    expect(applySectionFullWidth(section(), false)).toEqual({});
  });

  it("moves an image-only band back without adding a colour", () => {
    const block = section({
      styles: { padding: ZERO },
      wrapper: {
        fullWidth: true,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
    expect(applySectionFullWidth(block, false)).toEqual({
      wrapper: undefined,
      styles: { padding: ZERO },
      backgroundImage: createBackgroundImage(IMAGE),
    });
  });

  it("does not overwrite a section fill when turning full width off", () => {
    const block = section({
      styles: {
        backgroundColor: "#abcdef",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      wrapper: { fullWidth: true, backgroundColor: BAND },
    });
    expect(applySectionFullWidth(block, false)).toEqual({
      wrapper: { fullWidth: false, backgroundColor: BAND },
    });
  });

  it("refuses to create a wrapper the host or a wrapping layout forbids", () => {
    const bare = section();
    const layout = createDefaultTemplateContent();
    layout.blocks = [createWrapperBlock({ children: [createSlotBlock()] })];
    expect(sectionFullWidthDisabled(bare, { sectionWrapper: false })).toBe(
      true,
    );
    expect(sectionFullWidthDisabled(bare, { layout })).toBe(true);
    expect(sectionFullWidthDisabled(bare, {})).toBe(false);
    const existing = section({ wrapper: { backgroundColor: BAND } });
    expect(
      sectionFullWidthDisabled(existing, { sectionWrapper: false, layout }),
    ).toBe(false);
  });
});

describe("full-width toggle history", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  });

  it("undoes the moved fill and the new wrapper in one step", () => {
    const scope = effectScope();
    const { editor, history } = scope.run(() => {
      const content = createDefaultTemplateContent();
      const block = filledSection();
      content.blocks = [block];
      const editor = useEditor({ content });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      useHistoryInterceptor(editor, history);
      return { editor, history };
    })!;
    cleanups.push(() => scope.stop(), history.destroy);

    const id = editor.content.value.blocks[0]!.id;
    editor.updateBlock(
      id,
      applySectionFullWidth(
        editor.content.value.blocks[0] as SectionBlock,
        true,
      ),
    );

    const on = editor.content.value.blocks[0] as SectionBlock;
    expect(on.wrapper).toEqual({
      fullWidth: true,
      backgroundColor: BAND,
      backgroundImage: createBackgroundImage(IMAGE),
    });
    expect(on.styles.backgroundColor).toBeUndefined();
    expect(on.backgroundImage).toBeUndefined();
    expect(history.canUndo.value).toBe(true);

    history.undo();
    const restored = editor.content.value.blocks[0] as SectionBlock;
    expect(restored.wrapper).toBeUndefined();
    expect(restored.styles.backgroundColor).toBe(BAND);
    expect(restored.backgroundImage).toEqual(createBackgroundImage(IMAGE));
    expect(history.canUndo.value).toBe(false);
  });
});

function switchIn(wrapper: VueWrapper, testId: string) {
  const root = wrapper.get(`[data-testid="${testId}"]`);
  return root.get('button[role="switch"]');
}

function mountSettings(block: Block, provides: Record<symbol, unknown> = {}) {
  return mountEditor(CommonBlockSettings, {
    props: { block },
    provides: { [TRANSLATIONS_KEY]: en, ...provides },
  });
}

async function openBackground(wrapper: VueWrapper) {
  await wrapper
    .get('[data-testid="block-settings-background"]')
    .trigger("click");
}

describe("full-width background toggle", () => {
  it("emits one partial from the section background panel", async () => {
    const block = filledSection();
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    const toggle = switchIn(wrapper, "section-background-full-width");
    expect(toggle.attributes("aria-label")).toBe(
      en.blockSettings.fullWidthBackground,
    );
    expect(toggle.attributes("aria-checked")).toBe("false");
    await toggle.trigger("click");
    expect(wrapper.emitted("update")).toEqual([
      [applySectionFullWidth(block, true)],
    ]);
  });

  it("disables the section toggle when turning it on would create a forbidden wrapper", async () => {
    const layout = createDefaultTemplateContent();
    layout.blocks = [createWrapperBlock({ children: [createSlotBlock()] })];
    const wrapper = mountSettings(section(), {
      [LAYOUT_KEY]: layout,
    });
    await openBackground(wrapper);
    const button = switchIn(wrapper, "section-background-full-width")
      .element as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await switchIn(wrapper, "section-background-full-width").trigger("click");
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("shows the same state on the wrapper panel", async () => {
    const block = section({
      wrapper: { fullWidth: true, backgroundColor: BAND, padding: PADDING },
    });
    const wrapper = mountEditor(SectionToolbar, {
      props: { block },
      provides: { [TRANSLATIONS_KEY]: en },
    });
    const toggle = switchIn(wrapper, "section-wrapper-full-width");
    expect(toggle.attributes("aria-checked")).toBe("true");
    expect(toggle.attributes("aria-label")).toBe(
      en.blockSettings.fullWidthBackground,
    );
    await toggle.trigger("click");
    expect(wrapper.emitted("update")).toEqual([
      [applySectionFullWidth(block, false)],
    ]);
  });

  it("shows an empty band colour when the full-width wrapper has none", async () => {
    const block = section({
      styles: { backgroundColor: CONTENT, padding: ZERO },
      wrapper: { fullWidth: true },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    const pickers = wrapper.findAllComponents(ColorPicker);
    expect(pickers.map((picker) => picker.props("modelValue"))).toEqual([
      "",
      CONTENT,
    ]);
  });

  it("writes a colour picked while full width is on onto the wrapper", async () => {
    const block = section({
      styles: { backgroundColor: CONTENT, padding: ZERO },
      wrapper: { fullWidth: true, backgroundColor: BAND },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    await wrapper
      .findAllComponents(ColorPicker)[0]
      .get("input")
      .setValue(PICKED);
    expect(wrapper.emitted("update")).toEqual([
      [{ wrapper: { fullWidth: true, backgroundColor: PICKED } }],
    ]);
  });

  it("writes an image picked while full width is on onto the wrapper", async () => {
    const block = section({
      styles: { padding: ZERO },
      backgroundImage: createBackgroundImage("https://cdn.test/content.png"),
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    await wrapper
      .get('[data-testid="section-bg-url"] input')
      .setValue(EDITED_IMAGE);
    expect(wrapper.emitted("update")!.at(-1)![0]).toEqual({
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        backgroundImage: createBackgroundImage(EDITED_IMAGE),
      },
    });
  });

  it("shows the moved band colour and image after full width turns on", async () => {
    const block = filledSection();
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    await switchIn(wrapper, "section-background-full-width").trigger("click");
    const partial = wrapper.emitted("update")![0][0] as Partial<SectionBlock>;
    await wrapper.setProps({ block: { ...block, ...partial } });

    const pickers = wrapper.findAllComponents(ColorPicker);
    expect(pickers).toHaveLength(2);
    expect(pickers[0].props("modelValue")).toBe(BAND);
    expect(pickers[1].props("modelValue")).toBe("");
    expect(
      wrapper.getComponent(BackgroundImageControl).props("modelValue"),
    ).toEqual(createBackgroundImage(IMAGE));
    expect(
      wrapper.get('[data-locale-path="wrapper.backgroundColor"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-locale-path="wrapper.backgroundImage"]').exists(),
    ).toBe(true);
  });

  it("writes content background onto the section fill only", async () => {
    const block = section({
      styles: { padding: ZERO },
      wrapper: { fullWidth: true, backgroundColor: BAND },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    expect(wrapper.text()).toContain(en.blockSettings.contentBackground);
    const pickers = wrapper.findAllComponents(ColorPicker);
    expect(pickers.map((picker) => picker.props("modelValue"))).toEqual([
      BAND,
      "",
    ]);
    await pickers[1].get("input").setValue(CONTENT);
    expect(wrapper.emitted("update")).toEqual([
      [
        {
          styles: { padding: ZERO, backgroundColor: CONTENT },
        },
      ],
    ]);

    const off = mountSettings(
      section({ styles: { backgroundColor: CONTENT, padding: ZERO } }),
    );
    await openBackground(off);
    expect(off.text()).not.toContain(en.blockSettings.contentBackground);
    expect(off.findAllComponents(ColorPicker)).toHaveLength(1);
    expect(
      off.get('[data-locale-path="styles.backgroundColor"]').exists(),
    ).toBe(true);
  });

  it("moves a band colour edited in the background panel back onto the section", async () => {
    const block = section({
      styles: { padding: ZERO },
      wrapper: { fullWidth: true, backgroundColor: BAND },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    await wrapper
      .findAllComponents(ColorPicker)[0]
      .get("input")
      .setValue(PICKED);
    const edited = {
      ...block,
      ...(wrapper.emitted("update")![0][0] as Partial<SectionBlock>),
    } as SectionBlock;
    expect(isToggleOwnedWrapper(edited.wrapper!)).toBe(true);
    await wrapper.setProps({ block: edited });
    await switchIn(wrapper, "section-background-full-width").trigger("click");
    expect(wrapper.emitted("update")!.at(-1)![0]).toEqual({
      wrapper: undefined,
      styles: { padding: ZERO, backgroundColor: PICKED },
      backgroundImage: undefined,
    });
  });

  it("keeps the band and the content fill when full width turns off", () => {
    const block = section({
      styles: { backgroundColor: CONTENT, padding: ZERO },
      wrapper: {
        fullWidth: true,
        backgroundColor: PICKED,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
    expect(isToggleOwnedWrapper(block.wrapper!)).toBe(true);
    expect(applySectionFullWidth(block, false)).toEqual({
      wrapper: {
        fullWidth: false,
        backgroundColor: PICKED,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
  });

  it("shows the same band colour and image on the wrapper panel", async () => {
    const block = section({
      styles: { backgroundColor: CONTENT, padding: ZERO },
      backgroundImage: createBackgroundImage("https://cdn.test/content.png"),
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        backgroundImage: createBackgroundImage(IMAGE),
      },
    });
    const settings = mountSettings(block);
    await openBackground(settings);
    expect(
      settings.get('[data-locale-path="wrapper.backgroundColor"]').get("input")
        .element,
    ).toHaveProperty("value", BAND);
    expect(
      settings.getComponent(BackgroundImageControl).props("modelValue"),
    ).toEqual(createBackgroundImage(IMAGE));

    const toolbar = mountEditor(SectionToolbar, {
      props: { block },
      provides: { [TRANSLATIONS_KEY]: en },
    });
    expect(
      toolbar.get('[data-locale-path="wrapper.backgroundColor"]').get("input")
        .element,
    ).toHaveProperty("value", BAND);
    expect(
      toolbar.getComponent(BackgroundImageControl).props("modelValue"),
    ).toEqual(createBackgroundImage(IMAGE));
  });

  it("sets fullWidth on a layout wrapper block", async () => {
    const block = createWrapperBlock({
      styles: { backgroundColor: BAND, padding: PADDING },
    });
    const wrapper = mountSettings(block);
    await openBackground(wrapper);
    const toggle = switchIn(wrapper, "layout-wrapper-full-width");
    expect((toggle.element as HTMLButtonElement).disabled).toBe(false);
    await toggle.trigger("click");
    expect(wrapper.emitted("update")).toEqual([[{ fullWidth: true }]]);
  });
});

function titleRegistry() {
  return {
    getComponent: vi.fn((block: Block) =>
      block.type === "title" ? TitleBlock : undefined,
    ),
  } as unknown as UseBlockRegistryReturn;
}

describe("full-width band on the canvas", () => {
  it("bleeds the section band and keeps the section box at the email width", () => {
    const block = section({
      styles: {
        backgroundColor: "#abcdef",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      wrapper: {
        fullWidth: true,
        backgroundColor: BAND,
        padding: PADDING,
        borderRadius: 12,
      },
    });
    const wrapper = mountEditor(BlockWrapper, {
      props: {
        block,
        isSelected: false,
        viewport: "desktop" as const,
        previewMode: true,
      },
      slots: { default: () => h("p", "BANDCOPY") },
    });
    const band = wrapper.get(".tpl-section-wrapper");
    // happy-dom drops `width: 100cqw` from the serialized attribute. The other
    // bleed declarations are what it keeps, and the width is the same object.
    expect(getSectionWrapperStyle(block)?.width).toBe("100cqw");
    // The width assertion above is the helper; the element binds that object.
    expect(band.attributes("style")).toContain("max-width: none");
    expect(band.attributes("style")).toContain(
      "margin-inline: calc(50% - 50cqw)",
    );
    expect(band.attributes("style")).toContain(`background-color: ${BAND}`);
    expect(band.attributes("style")).not.toContain("border-radius");
    expect(band.attributes("style")).not.toContain("padding");
    const frame = wrapper.get(".tpl-band-frame");
    expect(frame.attributes("style")).toContain(
      "width: var(--tpl-email-frame-width)",
    );
    expect(frame.attributes("style")).toContain("padding: 20px");
    expect(wrapper.get(".tpl-block-content").text()).toBe("BANDCOPY");
    expect(band.classes()).toContain("tpl-email-surface");
  });

  it("leaves a non-full-width section wrapper without the bleed frame", () => {
    const block = section({
      wrapper: { backgroundColor: BAND, borderRadius: 12, padding: PADDING },
    });
    const wrapper = mountEditor(BlockWrapper, {
      props: {
        block,
        isSelected: false,
        viewport: "desktop" as const,
        previewMode: false,
      },
      slots: { default: () => h("p", "BANDCOPY") },
    });
    expect(wrapper.find(".tpl-band-frame").exists()).toBe(false);
    const band = wrapper.get(".tpl-section-wrapper");
    expect(band.attributes("style")).toContain("border-radius: 12px");
    expect(band.attributes("style")).toContain("padding: 20px");
    expect(band.attributes("style")).not.toContain("100cqw");
    expect(
      band.element.firstElementChild?.classList.contains("tpl-block-content"),
    ).toBe(true);
  });

  it("bleeds a layout wrapper and keeps its children in the email-width frame", () => {
    const title = createTitleBlock({ content: "<p>BANDCOPY</p>", level: 2 });
    const block: WrapperBlock = createWrapperBlock({
      fullWidth: true,
      borderRadius: 16,
      styles: { backgroundColor: BAND, padding: PADDING },
      children: [title],
    });
    const wrapper = mountEditor(WrapperBlockView, {
      props: { block, viewport: "desktop" },
      provides: { [BLOCK_REGISTRY_KEY]: titleRegistry() },
    });
    const band = wrapper.get('[data-testid="layout-wrapper"]');
    expect(getWrapperStyle(block)?.width).toBe("100cqw");
    expect(band.attributes("style")).not.toContain("border-radius");
    expect(band.attributes("style")).not.toContain("padding");
    const frame = wrapper.get(".tpl-band-frame");
    expect(frame.attributes("style")).toContain(
      "width: var(--tpl-email-frame-width)",
    );
    expect(frame.attributes("style")).toContain("padding: 20px");
    expect(frame.text()).toBe("BANDCOPY");
  });

  it("measures full-width bands against the canvas pane and the preview stage", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../src/styles/index.css"),
      "utf8",
    );
    expect(css).toContain(".tpl-canvas-pane");
    expect(css).toContain("container-type: inline-size");

    const editor = readFileSync(
      join(import.meta.dirname, "../src/Editor.vue"),
      "utf8",
    );
    expect(editor).toContain("tpl-main tpl-canvas-pane");

    const preview = mountEditor(BlockPreviewCanvas, {
      props: {
        blocks: [createParagraphBlock({ content: "<p>BANDCOPY</p>" })],
        viewport: "mobile",
      },
    });
    expect(
      preview.get('[data-testid="block-preview-stage"]').classes(),
    ).toContain("tpl-canvas-pane");
    expect(
      preview.get('[data-testid="block-preview-canvas"]').attributes("style"),
    ).toContain("--tpl-email-frame-width: 375px");
  });
});

describe("full-width background copy", () => {
  it("uses a dedicated label in every locale, distinct across Romance languages", () => {
    const labels = LOCALES.map(
      (locale) => locale.blockSettings.fullWidthBackground,
    );
    expect(labels).toEqual([
      "Full-width background",
      "Hintergrund über die volle Breite",
      "Arrière-plan sur toute la largeur",
      "Fondo a todo lo ancho",
      "Fons a tota l'amplada",
      "Fundo na largura da tela",
      "Achtergrond over de volle breedte",
      "画面幅いっぱいの背景",
    ]);
    for (const locale of LOCALES) {
      const label = locale.blockSettings.fullWidthBackground;
      expect(label).not.toBe(locale.image.fullWidth);
      expect(label).not.toBe(locale.button.fullWidth);
      expect(label).not.toBe(locale.video.fullWidth);
    }
    const romance = [fr, es, ca, ptBR].map(
      (locale) => locale.blockSettings.fullWidthBackground,
    );
    expect(new Set(romance).size).toBe(romance.length);
  });

  it("names the content background in every locale, distinct from the other background labels", () => {
    expect(
      LOCALES.map((locale) => locale.blockSettings.contentBackground),
    ).toEqual([
      "Content background",
      "Hintergrund des Inhalts",
      "Arrière-plan du contenu",
      "Fondo del contenido",
      "Fons del contingut",
      "Fundo do conteúdo",
      "Achtergrond van de inhoud",
      "コンテンツの背景",
    ]);
    for (const locale of LOCALES) {
      const label = locale.blockSettings.contentBackground;
      expect(label).not.toBe(locale.blockSettings.color);
      expect(label).not.toBe(locale.blockSettings.background);
      expect(label).not.toBe(locale.blockSettings.fullWidthBackground);
      expect(label).not.toBe(locale.templateSettings.backgroundColor);
    }
    const romance = [fr, es, ca, ptBR].map(
      (locale) => locale.blockSettings.contentBackground,
    );
    expect(new Set(romance).size).toBe(romance.length);
  });
});
