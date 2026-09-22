# Templates

Load and save the template

init({ templates }) — save, load, rename, and optional autosave.

Contract: https://docs.templatical.com/backend/templates
Live: https://play.templatical.com/scenes/templates

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    // replace with your API
    list: async () => [],
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
});

await editor.create({ name: "Templates" });
```
