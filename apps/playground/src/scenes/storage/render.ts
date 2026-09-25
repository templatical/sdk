import { compileMjmlDemo } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const render: Scene = {
  id: "render",
  title: "Render",
  job: "Export MJML and HTML",
  initKey: "render",
  summary:
    "init({ render: { compileMjml } }) — editor.toMjml() locally, toHtml() through one compiler.",
  affordance: "export",
  catalog: "oss",
  group: "backend",
  docs: "/backend/render",
  content: () => storageCanvas(),
  config: () => ({
    render: { compileMjml: compileMjmlDemo },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  render: {
    // replace with your API
    compileMjml: async (mjml) => {
      const res = await fetch("/api/mjml", { method: "POST", body: mjml });
      return res.text();
    },
  },
});

const mjml = await editor.toMjml();
const html = await editor.toHtml();`,
};
