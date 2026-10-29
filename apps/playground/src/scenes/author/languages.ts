import {
  AI_RECORDINGS,
  createMockAiProvider,
  createMockTranslationProvider,
} from "@templatical/ai-kit/testing";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createSpacerBlock,
  createTableBlock,
  createVideoBlock,
  createWrapperBlock,
  createTitleBlock,
  sourceHash,
  type Block,
  type TemplateContent,
  type TranslationProvider,
} from "@templatical/types";
import { createSharedCollaboration } from "../../host/collaboration/client";
import {
  PLAYGROUND_USER,
  commentsProviderFor,
  templatesProviderFor,
} from "../../host/providers";
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

// `?scale=1`: the editor's eight UI languages (English is the default) plus
// twelve others, over 300 blocks of mixed types.
const SCALE_LOCALES = [
  "de",
  "fr",
  "es",
  "ja",
  "nl",
  "ca",
  "pt-BR",
  "ar",
  "it",
  "pl",
  "sv",
  "da",
  "fi",
  "nb",
  "cs",
  "hu",
  "tr",
  "ko",
  "zh-CN",
];
const SCALE_BLOCKS = 300;

/** Records each call's field and character counts for the scale measurement. */
function countingTranslation(): TranslationProvider {
  const mock = createMockTranslationProvider();
  return {
    translate(request, signal) {
      const w = window as {
        __tplPlaygroundTranslateCalls?: { fields: number; chars: number }[];
      };
      (w.__tplPlaygroundTranslateCalls ??= []).push({
        fields: request.fields.length,
        chars: request.fields.reduce(
          (sum, field) => sum + field.text.length,
          0,
        ),
      });
      return mock.translate(request, signal);
    },
  };
}

/**
 * Each block's text is translated in half the languages and out of date in a
 * tenth of them, varying by block so every language has its own gaps.
 */
function scaleTranslations(
  index: number,
  fields: Record<string, string>,
  html: boolean,
): Pick<Block, "l10n"> {
  const entries = SCALE_LOCALES.flatMap((locale, offset) => {
    if ((index + offset) % 2) return [];
    const stale = (index + offset) % 10 === 0;
    const text = Object.fromEntries(
      Object.entries(fields).map(([path, value]) => [
        path,
        {
          value: html
            ? value.replace("<p>", `<p>[${locale}] `)
            : `[${locale}] ${value}`,
          sourceHash: sourceHash(stale ? `${value} (earlier)` : value),
        },
      ]),
    );
    return [[locale, { text }]];
  });
  return { l10n: Object.fromEntries(entries) };
}

function scaleBlock(index: number): Block[] {
  const id = `scale-${index}`;
  const line = `Line ${index} of the Sable autumn update`;
  switch (index % 13) {
    case 0:
      return [
        createTitleBlock({
          id,
          content: `<p>${line}</p>`,
          ...scaleTranslations(index, { content: `<p>${line}</p>` }, true),
        }),
      ];
    case 1:
    case 6:
      return [
        createParagraphBlock({
          id,
          content: `<p>Hello {{first_name}}, ${line.toLowerCase()}.</p>`,
          ...scaleTranslations(
            index,
            { content: `<p>Hello {{first_name}}, ${line.toLowerCase()}.</p>` },
            true,
          ),
        }),
      ];
    case 2:
      return [
        createImageBlock({
          id,
          src: "/examples/sable/speaker.png",
          alt: line,
          ...scaleTranslations(index, { alt: line }, false),
        }),
      ];
    case 3:
      return [
        createButtonBlock({
          id,
          text: `Shop line ${index}`,
          url: "https://example.com",
          ...scaleTranslations(index, { text: `Shop line ${index}` }, false),
        }),
      ];
    case 4:
      return [
        createMenuBlock({
          id,
          items: [
            { id: "new", text: "New in", url: "https://example.com/new" },
            { id: "sale", text: "Sale", url: "https://example.com/sale" },
          ].map((item) => ({
            ...item,
            openInNewTab: false,
            bold: false,
            underline: false,
          })),
          ...scaleTranslations(
            index,
            { "items.new.text": "New in", "items.sale.text": "Sale" },
            false,
          ),
        }),
      ];
    case 5: {
      const column = (side: string) =>
        createParagraphBlock({
          id: `${id}-${side}`,
          content: `<p>${line}, ${side} column.</p>`,
          ...scaleTranslations(
            index,
            { content: `<p>${line}, ${side} column.</p>` },
            true,
          ),
        });
      return [
        createSectionBlock({
          id,
          columns: "2",
          children: [[column("left")], [column("right")]],
        }),
      ];
    }
    case 7:
      return [
        createVideoBlock({
          id,
          alt: `Video for line ${index}`,
          ...scaleTranslations(
            index,
            { alt: `Video for line ${index}` },
            false,
          ),
        }),
      ];
    case 8:
      return [
        createTableBlock({
          id,
          rows: [
            { id: "head", cells: [{ id: "item", content: "Item" }] },
            { id: "body", cells: [{ id: "item", content: line }] },
          ],
          ...scaleTranslations(
            index,
            {
              "rows.head.cells.item.content": "Item",
              "rows.body.cells.item.content": line,
            },
            false,
          ),
        }),
      ];
    case 9:
      return [createDividerBlock({ id })];
    case 10:
      return [
        createHtmlBlock({
          id,
          content: `<p>${line}</p>`,
          ...scaleTranslations(index, { content: `<p>${line}</p>` }, true),
        }),
      ];
    case 11:
      return [createSpacerBlock({ id })];
    default:
      return [
        createParagraphBlock({
          id,
          content: `<p>${line}.</p>`,
          ...scaleTranslations(index, { content: `<p>${line}.</p>` }, true),
        }),
      ];
  }
}

/** 300 blocks, counting a section's two children, in 20 languages. */
function scaleCanvas(): TemplateContent {
  const content = createDefaultTemplateContent(undefined, { locale: "en" });
  content.settings.locales = [...SCALE_LOCALES];
  content.settings.l10n = { ar: { set: { direction: "rtl" } } };
  const blocks: Block[] = [];
  let count = 0;
  for (let index = 0; count < SCALE_BLOCKS; index++) {
    const next = scaleBlock(index);
    const size = next[0].type === "section" ? 3 : 1;
    if (count + size > SCALE_BLOCKS) continue;
    blocks.push(...next);
    count += size;
  }
  content.blocks = blocks;
  return content;
}

function translationFor(ctx: SceneContext): TranslationProvider {
  if (ctx.search.get("scale") === "1") return countingTranslation();
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
  if (ctx.search.get("scale") === "1") return scaleCanvas();
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
    "init({ templates, layout, localization, translation, ai }) enables language versions, recorded translations and Rewrite in one template. Switch to Deutsch and translate the gaps in the language bar, or Re-translate on the stale block. Add French to translate a new version; Arabic shows right-to-left content. The do-not-translate list protects Sable during translation. The layout footer follows the selected language and falls back to English when the layout lacks it. The variants demonstrate a changed tag, partial results on Cancel, collaboration locks and a template of 300 blocks in 20 languages.",
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
      locales:
        ctx.search.get("scale") === "1"
          ? [...SCALE_LOCALES]
          : ["de", "fr", "ar"],
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
        comments: commentsProviderFor("languages"),
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
      user: PLAYGROUND_USER,
      comments: commentsProviderFor("languages"),
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
const user = { id: "playground-user", name: "Playground User" };
const comments = new Map();
const translations = ${JSON.stringify(TRANSLATIONS, null, 2)};
const editor = await init({
  container: document.getElementById("editor"),
  user: user,
  comments: {
    list: async () => structuredClone([...comments.values()]),
    create: async (_templateId, input) => {
      const comment = {
        ...input,
        id: crypto.randomUUID(),
        author: user,
        createdAt: new Date().toISOString(),
      };
      if (input.parentId) {
        const parent = comments.get(input.parentId);
        if (!parent) throw new Error("Comment thread not found.");
        (parent.replies ??= []).push(comment);
      } else {
        comments.set(comment.id, comment);
      }
      return structuredClone(comment);
    },
    update: false,
    delete: false,
    setResolved: false,
  },
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
    { name: "300 blocks in 20 languages", query: { scale: "1" } },
  ],
};
