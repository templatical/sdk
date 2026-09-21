import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

export const fonts: Scene = {
  id: "fonts",
  title: "Fonts",
  summary:
    "init({ fonts: { builtIns } }) — restrict the picker to an on-brand allowlist.",
  catalog: "oss",
  group: "author",
  docs: "/guide/fonts",
  content: () => emptyCanvas(),
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
