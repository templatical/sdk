import { createDefaultTemplateContent } from "@templatical/types";
import type { Scene } from "./types";

export const minimum: Scene = {
  id: "minimum",
  title: "Minimum setup",
  job: "Empty canvas, nothing wired",
  summary: "init({ container }) — empty canvas, no providers.",
  catalog: "oss",
  group: "minimum",
  docs: "/getting-started/quick-start#mount-the-editor",
  content: () => createDefaultTemplateContent(),
  config: () => ({}),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
});`,
};
