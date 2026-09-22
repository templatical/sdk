import {
  templatesProviderFor,
  versionHistoryProviderFor,
} from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const versionHistory: Scene = {
  id: "version-history",
  title: "Version history",
  job: "Restore an earlier snapshot",
  summary:
    "init({ templates, versionHistory }) — browse, preview, and restore past saves.",
  affordance: "history",
  catalog: "oss",
  group: "backend",
  docs: "/backend/version-history",
  content: () => storageCanvas(),
  config(ctx) {
    const readonly = ctx.search.get("readonly") === "1";
    return {
      templates: templatesProviderFor("version-history"),
      versionHistory: versionHistoryProviderFor("version-history", {
        readonly,
      }),
    };
  },
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    // replace with your API
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
  versionHistory: {
    // replace with your API
    list: async (templateId) =>
      fetch(\`/api/templates/\${templateId}/versions\`).then((r) => r.json()),
    get: async (templateId, versionId) =>
      fetch(\`/api/templates/\${templateId}/versions/\${versionId}\`).then((r) =>
        r.json(),
      ),
    create: false,
    restore: async (templateId, versionId) =>
      fetch(\`/api/templates/\${templateId}/versions/\${versionId}/restore\`, {
        method: "POST",
      }).then((r) => r.json()),
  },
});

await editor.create({ name: "Version history" });`,
  variants: [{ name: "Read-only", query: { readonly: "1" } }],
};
