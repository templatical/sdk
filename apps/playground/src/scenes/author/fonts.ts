import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

export const fonts: Scene = {
  id: "fonts",
  title: "Fonts",
  job: "Limit the type menu",
  initKey: "fonts",
  summary:
    "init({ fonts: { builtIns } }) — restrict the picker to an on-brand allowlist.",
  affordance: "font",
  catalog: "oss",
  group: "configure",
  docs: "/guide/fonts",
  content: () => setupBaseCanvas(),
  config: () => ({
    fonts: {
      builtIns: ["Georgia", "Times New Roman", "Arial"],
    },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  fonts: {
    builtIns: ["Georgia", "Times New Roman", "Arial"],
  },
});`,
};
