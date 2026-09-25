import {
  PLAYGROUND_USER,
  commentsProviderFor,
  templatesProviderFor,
} from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const comments: Scene = {
  id: "comments",
  title: "Comments",
  job: "Thread a note on a block",
  initKey: "comments",
  summary:
    "init({ templates, comments, user }) — threaded review on the attached template.",
  affordance: "comment",
  catalog: "oss",
  group: "backend",
  docs: "/backend/comments",
  content: () => storageCanvas(),
  config(ctx) {
    const readonly = ctx.search.get("readonly") === "1";
    return {
      templates: templatesProviderFor("comments"),
      comments: commentsProviderFor("comments", { readonly }),
      user: PLAYGROUND_USER,
    };
  },
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  user: { id: "u_7", name: "Ada Lovelace" },
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
  comments: {
    // replace with your API
    list: async (templateId) =>
      fetch(\`/api/templates/\${templateId}/comments\`).then((r) => r.json()),
    create: async (templateId, input) =>
      fetch(\`/api/templates/\${templateId}/comments\`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.json()),
    update: async (templateId, commentId, patch) =>
      fetch(\`/api/templates/\${templateId}/comments/\${commentId}\`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.json()),
    delete: async (templateId, commentId) => {
      await fetch(\`/api/templates/\${templateId}/comments/\${commentId}\`, {
        method: "DELETE",
      });
    },
    setResolved: async (templateId, commentId, resolved) =>
      fetch(\`/api/templates/\${templateId}/comments/\${commentId}/resolve\`, {
        method: "POST",
        body: JSON.stringify({ resolved }),
      }).then((r) => r.json()),
  },
});

await editor.create({ name: "Comments" });`,
  variants: [{ name: "Read-only", query: { readonly: "1" } }],
};
