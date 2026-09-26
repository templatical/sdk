import { templatesProviderFor } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const templates: Scene = {
  id: "templates",
  title: "Templates",
  job: "Load and save the template",
  initKey: "templates",
  summary: "init({ templates }) — save, load, rename, and optional autosave.",
  catalog: "oss",
  group: "backend",
  docs: "/backend/templates",
  content: () => storageCanvas(),
  config(ctx) {
    const readonly = ctx.search.get("readonly") === "1";
    const autoSave = ctx.search.get("autosave") === "1";
    return {
      templates: {
        ...templatesProviderFor("templates", {
          readonly,
          autosave: autoSave,
        }),
        autoSave,
      },
    };
  },
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    // replace with your API
    list: async () => [],
    load: async (id) => fetch(\`/api/templates/\${id}\`).then((r) => r.json()),
    save: async (id, patch) =>
      fetch(\`/api/templates/\${id}\`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.json()),
    create: async (input) =>
      fetch("/api/templates", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.json()),
  },
});

await editor.create({ name: "Templates" });`,
  variants: [
    { name: "Read-only", query: { readonly: "1" } },
    { name: "Autosave", query: { autosave: "1" } },
  ],
};
