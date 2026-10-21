import { createSharedCollaboration } from "../../host/collaboration/client";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

/** The one template every tab of this setup opens. */
export const COLLABORATION_TEMPLATE_ID = "playground-collaboration";

export const collaboration: Scene = {
  id: "collaboration",
  title: "Collaboration",
  job: "Edit one template from two tabs",
  initKey: "collaboration",
  summary:
    "init({ templates, collaboration, user }) — live edits, presence and block locks between tabs, on the operation engine.",
  catalog: "oss",
  group: "backend",
  docs: "/backend/collaboration",
  content: () => storageCanvas(),
  config(ctx) {
    // `?user=Ada` signs this tab in; without it, the tab joins as a guest.
    const name = ctx.search.get("user")?.trim();
    const user = name ? { id: `user-${name.toLowerCase()}`, name } : null;
    const shared = createSharedCollaboration({ user, seed: storageCanvas });
    return {
      templates: shared.templates,
      collaboration: shared.collaboration,
      ...(user ? { user } : {}),
    };
  },
  async open(editor) {
    await editor.load(COLLABORATION_TEMPLATE_ID);
  },
  snippet: `import { init } from "@templatical/editor";
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
    load: (id) => api(\`/api/templates/\${id}\`),
    create: false,
    // with collaboration, a save only renames
    save: (id, patch) =>
      api(\`/api/templates/\${id}\`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  collaboration: {
    // your realtime client: call handlers.onBatch, onLock, onMembers, …
    join: (templateId, session, handlers) =>
      realtime.join(templateId, session, handlers),
    submit: (templateId, batch) =>
      api(\`/api/templates/\${templateId}/operations\`, {
        method: "POST",
        body: JSON.stringify(batch),
      }),
    operationsAfter: (templateId, revision) =>
      api(\`/api/templates/\${templateId}/operations?after=\${revision}\`),
    acquireLock: (templateId, blockId) =>
      api(\`/api/templates/\${templateId}/locks\`, {
        method: "POST",
        body: JSON.stringify({ blockId }),
      }),
    renewLock: (templateId, blockId) =>
      api(\`/api/templates/\${templateId}/locks/\${blockId}\`, { method: "PUT" }),
    releaseLock: async (templateId, blockId) => {
      await fetch(\`/api/templates/\${templateId}/locks/\${blockId}\`, {
        method: "DELETE",
        keepalive: true,
      });
    },
  },
});

await editor.load("tpl_123");`,
  variants: [
    { name: "As Ada", query: { user: "Ada" } },
    { name: "As Grace", query: { user: "Grace" } },
  ],
};
