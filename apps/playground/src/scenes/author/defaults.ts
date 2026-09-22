import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

export const defaults: Scene = {
  id: "defaults",
  title: "Defaults",
  job: "New blocks stay on-brand",
  summary:
    "init({ blockDefaults, templateDefaults }) — brand-new blocks start on-brand.",
  affordance: "defaults",
  catalog: "oss",
  group: "configure",
  docs: "/guide/defaults",
  content: () => emptyCanvas(),
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
