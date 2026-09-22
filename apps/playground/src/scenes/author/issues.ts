import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

export const issues: Scene = {
  id: "issues",
  title: "Issues",
  job: "Lint the template as you edit",
  summary:
    "init({ lint }) — Issues tab from the optional @templatical/quality peer.",
  affordance: "lint",
  catalog: "oss",
  group: "author",
  docs: "/quality/",
  content: () => emptyCanvas(),
  config: () => ({
    lint: {},
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
// pnpm add @templatical/quality

const editor = await init({
  container: document.getElementById("editor"),
  lint: {},
});`,
};
