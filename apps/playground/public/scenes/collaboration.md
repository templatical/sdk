# Collaboration

Edit one template from two tabs

init({ templates, collaboration, user }) — live edits, presence and block locks between tabs, on the operation engine.

Contract: https://docs.templatical.com/backend/collaboration
Live: https://play.templatical.com/scenes/collaboration

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

// replace with your API: refusals keep the body's code, holder and holders
async function api(path, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.message), body);
  return body;
}

const editor = await init({
  container: document.getElementById("editor"),
  user: { id: "u_7", name: "Ada Lovelace" },
  templates: {
    // load returns the template's revision too
    load: (id) => api(`/api/templates/${id}`),
    create: false,
    // with collaboration, a save only renames
    save: (id, patch) =>
      api(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  collaboration: {
    // your realtime client: call handlers.onBatch, onLock, onMembers, …
    join: (templateId, session, handlers) =>
      realtime.join(templateId, session, handlers),
    submit: (templateId, batch) =>
      api(`/api/templates/${templateId}/operations`, {
        method: "POST",
        body: JSON.stringify(batch),
      }),
    operationsAfter: (templateId, revision) =>
      api(`/api/templates/${templateId}/operations?after=${revision}`),
    acquireLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks`, {
        method: "POST",
        body: JSON.stringify({ blockId }),
      }),
    renewLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks/${blockId}`, { method: "PUT" }),
    releaseLock: async (templateId, blockId) => {
      await fetch(`/api/templates/${templateId}/locks/${blockId}`, {
        method: "DELETE",
        keepalive: true,
      });
    },
  },
});

await editor.load("tpl_123");
```
