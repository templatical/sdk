import {
  AI_RECORDINGS,
  createMockAiProvider,
} from "@templatical/ai-kit/testing";
import { createSharedCollaboration } from "../../host/collaboration/client";
import { templatesProviderFor } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";
import { COLLABORATION_TEMPLATE_ID } from "./collaboration";

export const ai: Scene = {
  id: "ai",
  title: "AI",
  job: "Edit the template with an AI chat",
  initKey: "ai",
  summary:
    "init({ templates, ai }) — chat, rewrite, scoring with fixes and design to template over your AI backend; here a recorded mock, no model and no keys.",
  catalog: "oss",
  group: "backend",
  docs: "/backend/ai",
  pointer: {
    selector: '[data-testid="ai-menu-trigger"]',
    root: "editor",
    side: "below",
  },
  content: () => storageCanvas(),
  config(ctx) {
    // Recorded turns, played through the public contract (D38).
    const ai = createMockAiProvider({
      ...AI_RECORDINGS,
      conversation: ctx.search.get("history") === "1",
    });
    if (ctx.search.get("collaboration") === "1") {
      // `?user=Ada` signs this tab in; the AI's batches reach the other tabs
      // as "AI (for Ada)".
      const name = ctx.search.get("user")?.trim();
      const user = name ? { id: `user-${name.toLowerCase()}`, name } : null;
      const shared = createSharedCollaboration({ user, seed: storageCanvas });
      return {
        templates: shared.templates,
        collaboration: shared.collaboration,
        ai,
        ...(user ? { user } : {}),
      };
    }
    return { templates: templatesProviderFor("ai"), ai };
  },
  async open(editor, ctx) {
    if (ctx.search.get("collaboration") === "1") {
      await editor.load(COLLABORATION_TEMPLATE_ID);
    } else {
      await editor.create({ name: "AI" });
    }
  },
  snippet: `import { init } from "@templatical/editor";
import { createHttpAiProvider } from "@templatical/ai-kit/client";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  // AI works on a loaded template
  templates: {
    // replace with your API
    load: (id) => fetch(\`/api/templates/\${id}\`).then((r) => r.json()),
    create: false,
    save: (id, patch) =>
      fetch(\`/api/templates/\${id}\`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.json()),
  },
  // your backend speaks the wire: see "Bring your own AI backend"
  ai: createHttpAiProvider({
    baseUrl: "/api/ai",
    headers: async () => ({ Authorization: \`Bearer \${await getToken()}\` }),
  }),
});

await editor.load("tpl_123");`,
  variants: [
    { name: "With history", query: { history: "1" } },
    {
      name: "As Ada, with collaboration",
      query: { collaboration: "1", user: "Ada" },
    },
    {
      name: "As Grace, with collaboration",
      query: { collaboration: "1", user: "Grace" },
    },
  ],
};
