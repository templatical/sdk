import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

export const shadowDomOff: Scene = {
  id: "shadow-dom-off",
  title: "Shadow DOM off",
  summary:
    "init({ shadowDom: false }) — light-DOM mount. Live e2e still uses ?shadowDom=.",
  catalog: "oss",
  group: "author",
  docs: "/guide/shadow-dom",
  content: () => emptyCanvas(),
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
