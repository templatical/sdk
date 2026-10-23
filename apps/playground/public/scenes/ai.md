# AI

Chat, rewrite and fix issues

init({ templates, ai }) adds an AI assistant button that opens and closes chat. Attach files in chat or use Import from screenshot or PDF on the empty canvas; try static starters, Rewrite, Fix with AI and Write alt text using a recorded mock.

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
