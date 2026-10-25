import { createApp, h, onUnmounted, provide, ref } from "vue";
import { useEditor } from "../../../../packages/core/src/index";
import { createDefaultTemplateContent } from "../../../../packages/types/src/index";
import EditorHeader from "../../../../packages/editor/src/components/EditorHeader.vue";
import { useEditorCore } from "../../../../packages/editor/src/composables/useEditorCore";
import { useFonts } from "../../../../packages/editor/src/composables/useFonts";
import { loadTranslations } from "../../../../packages/editor/src/i18n";
import {
  LOCALIZATION_KEY,
  SIZE_CHECK_KEY,
} from "../../../../packages/editor/src/keys";
import { headerFeatures } from "../../../../packages/editor/tests/helpers/headerFeatures";
import css from "../../../../packages/editor/src/styles/index.css?inline";

type HeaderProps = InstanceType<typeof EditorHeader>["$props"];

export async function mountCrowdedHeader(shadowDom: boolean) {
  const host = document.createElement("div");
  host.dataset.testid = "language-header-harness";
  host.style.cssText =
    "position:fixed;inset:0;z-index:20000;background:var(--tpl-bg)";
  document.body.appendChild(host);
  const root = shadowDom ? host.attachShadow({ mode: "open" }) : host;
  const style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);
  const container = document.createElement("div");
  container.className = "tpl";
  container.style.cssText = "position:relative;height:100%";
  root.appendChild(container);
  const popover = document.createElement("div");
  root.appendChild(popover);
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de", "zh-Hant-HK"];
  const translations = await loadTranslations("en");
  const app = createApp({
    setup() {
      const editor = useEditor({
        content,
        localization: { locales: ["de", "zh-Hant-HK"] },
      });
      const fontsManager = useFonts(undefined);
      const core = useEditorCore({
        editor,
        config: { locale: "en", uiTheme: "light", lint: { disabled: true } },
        translations,
        fontsManager,
        editorRoot: root instanceof ShadowRoot ? root : document,
        containerEl: ref(container),
      });
      core.popoverRoot.value = popover;
      provide(LOCALIZATION_KEY, { locales: ["de", "zh-Hant-HK"] });
      provide(SIZE_CHECK_KEY, {
        renderHtml: async () => "",
        canRenderHtml: () => false,
        cloud: false,
        options: { disabled: true },
      });
      onUnmounted(() => {
        core.destroy();
        fontsManager.cleanupFontLinks();
      });
      const props = {
        editor,
        core,
        showTemplateName: true,
        localization: { locales: ["de", "zh-Hant-HK"] },
        ...headerFeatures(),
      } satisfies HeaderProps;
      return () => h(EditorHeader, props);
    },
  });
  app.mount(container);
  return () => {
    app.unmount();
    host.remove();
  };
}
