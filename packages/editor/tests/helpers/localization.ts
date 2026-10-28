import { afterEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  createImageBlock,
  sourceHash,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../../src/Editor.vue";
import Canvas from "../../src/components/Canvas.vue";
import { useFonts } from "../../src/composables/useFonts";
import { loadTranslations } from "../../src/i18n";
import { EDITOR_KEY, HISTORY_KEY } from "../../src/keys";
import type { UseEditorReturn } from "@templatical/core";
import type { TemplaticalEditorConfig } from "../../src/index";

export function languageContent(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de", "fr"];
  content.blocks = [
    createTitleBlock({
      id: "title",
      content: "Hello",
      l10n: {
        de: {
          text: { content: { value: "Hallo", sourceHash: sourceHash("Old") } },
          set: { color: "#123456" },
        },
      },
    }),
    createImageBlock({ id: "image", alt: "Product" }),
  ];
  return content;
}
const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});
export async function openLanguages(
  config: Partial<TemplaticalEditorConfig> = {},
) {
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: languageContent(),
        localization: { locales: ["de", "nl"] },
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true, "hex-color-picker": true } },
  });
  wrappers.push(wrapper);
  await vi.dynamicImportSettled();
  await flushPromises();
  const provides = (wrapper.findComponent(Canvas).vm as any).$.provides;
  return {
    wrapper,
    editor: provides[EDITOR_KEY as symbol] as UseEditorReturn,
    history: provides[HISTORY_KEY as symbol],
  };
}
export async function chooseLanguage(wrapper: VueWrapper, locale: string) {
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  await wrapper
    .get(`[data-testid="language-option-${locale}"]`)
    .trigger("click");
  await vi.dynamicImportSettled();
  await flushPromises();
}
