import type { Scene, SceneContext } from "../types";
import { emptyCanvas } from "./shared";

/** The locale the scene opens in: not English, so the effect shows. */
const DEFAULT_LOCALE = "de";

function localeOf(ctx: SceneContext): string {
  return ctx.search.get("locale") ?? DEFAULT_LOCALE;
}

function snippetWith(locale: string): string {
  return `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  locale: "${locale}",
});`;
}

export const i18n: Scene = {
  id: "i18n",
  title: "Internationalization",
  job: "Editor chrome in any of its languages",
  initKey: "locale",
  summary: 'init({ locale: "de" }) — German editor chrome and block defaults.',
  catalog: "oss",
  group: "configure",
  docs: "/guide/i18n#setting-the-locale",
  pointer: {
    selector: '[data-testid="scene-init-key"]',
    root: "page",
    side: "below",
  },
  valuePicker: {
    param: "locale",
    fallback: DEFAULT_LOCALE,
    values: "editor-locales",
  },
  content: (ctx) => emptyCanvas(localeOf(ctx)),
  config(ctx) {
    return { locale: localeOf(ctx) };
  },
  snippet: snippetWith(DEFAULT_LOCALE),
  snippetFor: (ctx) => snippetWith(localeOf(ctx)),
};
