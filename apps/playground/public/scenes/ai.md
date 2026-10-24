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

async function api(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json();
    throw Object.assign(new Error(body.message), body, { statusCode: res.status });
  }
  return res.json();
}

const editor = await init({
  container: document.getElementById("editor"),
  // AI works on a loaded template
  templates: {
    // replace with your API
    load: (id) => api(`/api/templates/${encodeURIComponent(id)}`),
    create: false,
    save: (id, patch) =>
      api(`/api/templates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  // your backend speaks the wire: see "Bring your own AI backend"
  ai: createHttpAiProvider({
    baseUrl: "/api/ai",
    // Your app's session cookie authenticates the request.
    credentials: "include",
  }),
});

await editor.load("tpl_123");
```
