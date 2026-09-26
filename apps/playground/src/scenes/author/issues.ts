import type { Scene } from "../types";
import { emptyCanvas, issuesCanvas } from "./shared";

export const issues: Scene = {
  id: "issues",
  title: "Issues",
  job: "Lint the template as you edit",
  initKey: "lint",
  summary:
    "init({ lint }) — Issues tab from the optional @templatical/quality peer.",
  catalog: "oss",
  group: "configure",
  docs: "/quality/#wire-into-the-editor",
  content: (ctx) =>
    ctx.search.get("canvas") === "blank" ? emptyCanvas() : issuesCanvas(),
  variants: [{ name: "Blank canvas", query: { canvas: "blank" } }],
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
