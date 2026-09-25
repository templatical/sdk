import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

export const i18n: Scene = {
  id: "i18n",
  title: "Internationalization",
  job: "German chrome and placeholders",
  initKey: "locale",
  summary: 'init({ locale: "de" }) — German editor chrome and block defaults.',
  catalog: "oss",
  group: "configure",
  docs: "/guide/i18n",
  content: (ctx) => emptyCanvas(ctx.search.get("locale") ?? "de"),
  config(ctx) {
    return { locale: ctx.search.get("locale") ?? "de" };
  },
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  locale: "de",
});`,
};
