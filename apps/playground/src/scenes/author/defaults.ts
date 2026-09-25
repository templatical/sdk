import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

export const defaults: Scene = {
  id: "defaults",
  title: "Defaults",
  job: "New blocks stay on-brand",
  initKey: "blockDefaults",
  summary:
    "init({ blockDefaults, templateDefaults }) — brand-new blocks start on-brand.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/defaults#block-defaults",
  content: () => setupBaseCanvas(),
  config: () => ({
    blockDefaults: {
      button: { backgroundColor: "#0f766e" },
    },
    templateDefaults: {
      backgroundColor: "#f8fafc",
    },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  blockDefaults: {
    button: { backgroundColor: "#0f766e" },
  },
  templateDefaults: {
    backgroundColor: "#f8fafc",
  },
});`,
};
