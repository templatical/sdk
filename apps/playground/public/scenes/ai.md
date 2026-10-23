# AI

Edit the template with an AI chat

init({ templates, ai }) — chat, static starters, rewrite and design to template over your AI backend; here a recorded mock, no model and no keys.

Contract: https://docs.templatical.com/backend/ai
Live: https://play.templatical.com/scenes/ai

## Snippet

```ts
import { init } from "@templatical/editor";
import { createHttpAiProvider } from "@templatical/ai-kit/client";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  // AI works on a loaded template
  templates: {
    // replace with your API
    load: (id) => fetch(`/api/templates/${id}`).then((r) => r.json()),
    create: false,
    save: (id, patch) =>
      fetch(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.json()),
  },
  // your backend speaks the wire: see "Bring your own AI backend"
  ai: createHttpAiProvider({
    baseUrl: "/api/ai",
    headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  }),
});

await editor.load("tpl_123");
```
