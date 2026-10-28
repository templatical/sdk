import {
  AI_RECORDINGS,
  createMockAiProvider,
  createMockTranslationProvider,
} from "@templatical/ai-kit/testing";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  createTitleBlock,
  sourceHash,
  type TranslationProvider,
} from "@templatical/types";
import { createSharedCollaboration } from "../../host/collaboration/client";
import { templatesProviderFor } from "../../host/providers";
import type { Scene, SceneContext } from "../types";

const TRANSLATIONS = {
  de: {
    "languages-title/content": "<p>Willkommen zur Herbstkollektion</p>",
    "languages-hero/alt": "Ein tragbarer Lautsprecher",
    "languages-copy/content": "<p>Entdecken Sie unsere neue Kollektion.</p>",
    "languages-stale/content":
      '<p>Das Angebot von <x id="1"/> endet am Freitag.</p>',
    "languages-us-only/content": "<p>Kostenloser Versand in den USA.</p>",
    "languages-tagged/content": '<p>Hallo <x id="1"/>.</p>',
  },
  fr: {
    "languages-title/content": "<p>Bienvenue dans la collection d’automne</p>",
    "languages-hero/alt": "Une enceinte portable",
    "languages-copy/content": "<p>Découvrez notre nouvelle collection.</p>",
    "languages-stale/content":
      '<p>L’offre de <x id="1"/> se termine vendredi.</p>',
    "languages-us-only/content": "<p>Livraison gratuite aux États-Unis.</p>",
    "languages-tagged/content": '<p>Bonjour <x id="1"/>.</p>',
  },
};
const GERMAN_REWRITE =
  "<p>Entdecken Sie die Highlights unserer Herbstkollektion.</p>";

function translationFor(ctx: SceneContext): TranslationProvider {
  const mock = createMockTranslationProvider({ translations: TRANSLATIONS });
  if (ctx.search.get("translation") === "tags-changed") {
    return {
      async translate(request, signal) {
        const result = await mock.translate(request, signal);
        return {
          fields: result.fields.map((field) =>
            field.id === "languages-tagged/content"
              ? { ...field, text: field.text.replace('<x id="1"/>', "") }
              : field,
          ),
        };
      },
    };
  }
  if (ctx.search.get("translation") === "cancel") {
    const delayed = createMockTranslationProvider({
      translations: TRANSLATIONS,
      delayMs: 10_000,
    });
    let calls = 0;
    return {
      translate(request, signal) {
        if (request.fields.length > 2)
          return Promise.reject(
            Object.assign(
              new Error("This demo translates at most two fields per call."),
              { name: "SdkError", code: "content_too_large" },
            ),
          );
        return (calls++ === 0 ? mock : delayed).translate(request, signal);
      },
    };
  }
  return mock;
}

function languagesCanvas(ctx: SceneContext) {
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
              sourceHash: sourceHash("<p>Welcome to the autumn collection</p>"),
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
              sourceHash: sourceHash("<p>Discover our new collection.</p>"),
            },
          },
        },
      },
    }),
    createParagraphBlock({
      id: "languages-stale",
      content: "<p>The Sable offer ends on Friday.</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Das Angebot von Sable endet am Donnerstag.</p>",
              sourceHash: sourceHash(
                "<p>The Sable offer ends on Thursday.</p>",
              ),
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
  if (ctx.search.get("translation") === "tags-changed")
    content.blocks.push(
      createParagraphBlock({
        id: "languages-tagged",
        content: "<p>Hello {{first_name}}.</p>",
      }),
    );
  return content;
}

function languagesLayout() {
  const layout = createDefaultTemplateContent(undefined, { locale: "en" });
  layout.settings.locales = ["de"];
  layout.blocks = [
    createWrapperBlock({
      id: "languages-layout",
      children: [
        { ...createSlotBlock(), id: "languages-slot" },
        createParagraphBlock({
          id: "languages-footer",
          content: "<p>Unsubscribe</p>",
          l10n: {
            de: {
              text: {
                content: {
                  value: "<p>Abmelden</p>",
                  sourceHash: sourceHash("<p>Unsubscribe</p>"),
                },
              },
            },
          },
        }),
      ],
    }),
  ];
  return layout;
}

export const languages: Scene = {
  id: "languages",
  title: "Languages",
  job: "Language versions of one template",
  initKey: "localization",
  summary:
    "init({ templates, layout, localization, translation, ai }) enables language versions, recorded translations and Rewrite in one template. Switch to Deutsch and use Translate from English to fill the gaps, or Re-translate on the stale block. Add French to translate a new version; Arabic shows right-to-left content. The do-not-translate list protects Sable during translation. The layout footer follows the selected language and falls back to English when the layout lacks it. The variants demonstrate a changed tag, partial results on Cancel and collaboration locks.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/localized-templates",
  pointer: {
    selector: '[data-testid="language-menu"]',
    root: "editor",
    side: "below",
  },
  content: languagesCanvas,
  config(ctx) {
    const layout = languagesLayout();
    const localization = {
      locales: ["de", "fr", "ar"],
      doNotTranslate: ["Sable"],
    };
    const translation = translationFor(ctx);
    const ai = createMockAiProvider({
      ...AI_RECORDINGS,
      rewrite: (request) =>
        request.locale === "de"
          ? [{ type: "done", html: GERMAN_REWRITE }]
          : typeof AI_RECORDINGS.rewrite === "function"
            ? AI_RECORDINGS.rewrite(request)
            : [],
    });
    if (ctx.search.get("collaboration") === "1") {
      const name = ctx.search.get("user")?.trim();
      const user = name ? { id: `user-${name.toLowerCase()}`, name } : null;
      const shared = createSharedCollaboration({
        user,
        seed: () => languagesCanvas(ctx),
      });
      return {
        templates: shared.templates,
        collaboration: shared.collaboration,
        layout,
        localization,
        translation,
        ai,
        ...(user ? { user } : {}),
      };
    }
    return {
      templates: templatesProviderFor("languages"),
      layout,
      localization,
      translation,
      ai,
    };
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
import { AI_RECORDINGS, createMockAiProvider, createMockTranslationProvider } from "@templatical/ai-kit/testing";
import "@templatical/editor/style.css";

// In-memory storage for this example; replace with your backend.
let template = { id: "languages", content: createDefaultTemplateContent() };
const translations = ${JSON.stringify(TRANSLATIONS, null, 2)};
const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    load: async () => template,
    create: false,
    save: async (id, patch) => (template = { ...template, ...patch, id }),
  },
  layout: ${JSON.stringify(languagesLayout(), null, 2)},
  localization: { locales: ["de", "fr", "ar"], doNotTranslate: ["Sable"] },
  translation: createMockTranslationProvider({ translations }),
  ai: createMockAiProvider({
    ...AI_RECORDINGS,
    rewrite: (request) => request.locale === "de"
      ? [{ type: "done", html: ${JSON.stringify(GERMAN_REWRITE)} }]
      : typeof AI_RECORDINGS.rewrite === "function"
        ? AI_RECORDINGS.rewrite(request)
        : [],
  }),
});

await editor.load("languages");`,
  variants: [
    { name: "With a changed tag", query: { translation: "tags-changed" } },
    { name: "Cancel a partial translation", query: { translation: "cancel" } },
    {
      name: "As Ada, with collaboration",
      query: { collaboration: "1", user: "Ada" },
    },
  ],
};
