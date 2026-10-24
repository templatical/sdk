import {
  AI_RECORDINGS,
  createMockAiProvider,
} from "@templatical/ai-kit/testing";
import { createImageBlock, createParagraphBlock } from "@templatical/types";
import { createSharedCollaboration } from "../../host/collaboration/client";
import { templatesProviderFor } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";
import { COLLABORATION_TEMPLATE_ID } from "./collaboration";

export const ai: Scene = {
  id: "ai",
  title: "AI",
  job: "Chat, rewrite and fix issues",
  initKey: "ai",
  summary:
    "init({ templates, ai }) adds an AI assistant button that opens and closes chat. Attach files in chat or use Import from screenshot or PDF on the empty canvas; try static starters, Rewrite, Fix with AI and Write alt text using a recorded mock.",
  catalog: "oss",
  group: "backend",
  docs: "/backend/ai",
  pointer: {
    selector: '[data-testid="ai-menu-trigger"]',
    root: "editor",
    side: "below",
  },
  content(ctx) {
    const content = storageCanvas();
    if (ctx.search.get("issues") !== "1") return content;
    content.blocks.push(
      createParagraphBlock({
        id: "ai-vague-link",
        content:
          '<p>Read our update: <a href="https://example.com/march">click here</a>.</p>',
      }),
      createParagraphBlock({
        id: "ai-domain-link",
        content:
          '<p>Our website: <a href="https://tracking.example.net/r/1">www.acme.com</a>.</p>',
      }),
      ...["speaker", "buds", "charger"].map((asset, index) =>
        createImageBlock({
          id: `ai-image-${index + 1}`,
          // The alt-text contract takes an http(s) URL; these stay on the
          // playground's origin and use its bundled example images.
          src: new URL(`/examples/sable/${asset}.png`, location.origin).href,
          alt: "",
        }),
      ),
    );
    return content;
  },
  config(ctx) {
    // Recorded turns, played through the public contract (D38).
    const ai = createMockAiProvider({
      ...AI_RECORDINGS,
      conversation: ctx.search.get("history") === "1",
      ...(ctx.search.get("noAltText") === "1"
        ? { altText: false as const }
        : {}),
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
    load: (id) => api(\`/api/templates/\${encodeURIComponent(id)}\`),
    create: false,
    save: (id, patch) =>
      api(\`/api/templates/\${encodeURIComponent(id)}\`, {
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

await editor.load("tpl_123");`,
  variants: [
    { name: "With issues", query: { issues: "1" } },
    { name: "Without alt text", query: { issues: "1", noAltText: "1" } },
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
