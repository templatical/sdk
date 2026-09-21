# Version history

init({ templates, versionHistory }) — browse, preview, and restore past saves.

Contract: https://docs.templatical.com/backend/version-history
Live: https://play.templatical.com/scenes/version-history

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    // replace with your API
    load: async (id) => fetch(`/api/templates/${id}`).then((r) => r.json()),
    save: async (id, patch) =>
      fetch(`/api/templates/${id}`, {
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
      fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
    get: async (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}`).then((r) =>
        r.json(),
      ),
    create: false,
    restore: async (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, {
        method: "POST",
      }).then((r) => r.json()),
  },
});

await editor.create({ name: "Version history" });
```
