import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createTitleBlock,
  sourceHash,
} from "@templatical/types";
import { createSharedCollaboration } from "../../host/collaboration/client";
import { templatesProviderFor } from "../../host/providers";
import type { Scene } from "../types";

function languagesCanvas() {
  const content = createDefaultTemplateContent(undefined, { locale: "en" });
  content.settings.locales = ["de", "ar"];
  content.settings.l10n = { ar: { set: { direction: "rtl" } } };
  content.blocks = [
    createTitleBlock({
      id: "languages-title",
      content: "<p>Welcome to the autumn collection</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Willkommen zur Herbstkollektion</p>",
              source: sourceHash("<p>Welcome to the autumn collection</p>"),
            },
          },
        },
      },
    }),
    createImageBlock({
      id: "languages-hero",
      src: "/examples/sable/speaker.png",
      alt: "A portable speaker",
      l10n: { de: { set: { src: "/examples/sable/buds.png" } } },
    }),
    createParagraphBlock({
      id: "languages-copy",
      content: "<p>Discover our new collection.</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Entdecken Sie unsere neue Kollektion.</p>",
              source: sourceHash("<p>Discover our new collection.</p>"),
            },
          },
        },
      },
    }),
    createParagraphBlock({
      id: "languages-stale",
      content: "<p>The offer ends on Friday.</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Das Angebot endet am Donnerstag.</p>",
              source: sourceHash("<p>The offer ends on Thursday.</p>"),
            },
          },
        },
      },
    }),
    createParagraphBlock({
      id: "languages-us-only",
      content: "<p>Free shipping in the United States.</p>",
      l10n: { de: { hidden: true } },
    }),
  ];
  return content;
}

export const languages: Scene = {
  id: "languages",
  title: "Languages",
  job: "Language versions of one template",
  initKey: "localization",
  summary:
    "init({ templates, localization }) enables language versions in one template. Switch to Deutsch for translated text, a different hero image, a hidden block and a stale value; Keep clears the stale marker. Add French or select Arabic for right-to-left content.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/localized-templates",
  pointer: {
    selector: '[data-testid="language-menu"]',
    root: "editor",
    side: "below",
  },
  content: () => languagesCanvas(),
  config(ctx) {
    const localization = { locales: ["de", "fr", "ar"] };
    if (ctx.search.get("collaboration") === "1") {
      const name = ctx.search.get("user")?.trim();
      const user = name ? { id: `user-${name.toLowerCase()}`, name } : null;
      const shared = createSharedCollaboration({ user, seed: languagesCanvas });
      return {
        templates: shared.templates,
        collaboration: shared.collaboration,
        localization,
        ...(user ? { user } : {}),
      };
    }
    return { templates: templatesProviderFor("languages"), localization };
  },
  async open(editor, ctx) {
    if (ctx.search.get("collaboration") === "1") {
      await editor.load("playground-languages");
    } else {
      await editor.create({ name: "Languages" });
    }
  },
  snippet: `import { init } from "@templatical/editor";
import { createDefaultTemplateContent } from "@templatical/types";
import "@templatical/editor/style.css";

// In-memory storage for this example; replace with your backend.
let template = { id: "languages", content: createDefaultTemplateContent() };
const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    load: async () => template,
    create: false,
    save: async (id, patch) => (template = { ...template, ...patch, id }),
  },
  localization: { locales: ["de", "fr", "ar"] },
});

await editor.load("languages");`,
  variants: [
    {
      name: "As Ada, with collaboration",
      query: { collaboration: "1", user: "Ada" },
    },
  ],
};
