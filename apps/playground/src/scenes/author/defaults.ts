import type { Scene } from "../types";

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
  pointer: {
    selector: '[data-palette-type="button"]',
    root: "editor",
    side: "right",
    replaces: "palette",
  },
  // No content: templateDefaults seeds only the blank template init() builds.
  config: () => ({
    blockDefaults: {
      button: { backgroundColor: "#0f766e" },
    },
    templateDefaults: {
      backgroundColor: "#e3f1ee",
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
    backgroundColor: "#e3f1ee",
  },
});`,
};
