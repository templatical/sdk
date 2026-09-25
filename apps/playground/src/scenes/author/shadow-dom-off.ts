import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

export const shadowDomOff: Scene = {
  id: "shadow-dom-off",
  title: "Shadow DOM off",
  job: "Mount in the page light DOM",
  initKey: "shadowDom: false",
  summary:
    "init({ shadowDom: false }) — light-DOM mount. Live e2e still uses ?shadowDom=.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/shadow-dom#opt-out-shadowdom-false",
  content: () => setupBaseCanvas(),
  config: () => ({
    shadowDom: false,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  shadowDom: false,
});`,
};
