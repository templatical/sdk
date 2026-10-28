# Languages

Language versions of one template

init({ templates, layout, localization, translation, ai }) enables language versions, recorded translations and Rewrite in one template. Switch to Deutsch and use Translate from English to fill the gaps, or Re-translate on the stale block. Add French to translate a new version; Arabic shows right-to-left content. The layout footer follows the selected language and falls back to English when the layout lacks it. The variants demonstrate a changed tag, partial results on Cancel and collaboration locks.

Contract: https://docs.templatical.com/guide/localized-templates
Live: https://play.templatical.com/scenes/languages

## Snippet

```ts
import { init } from "@templatical/editor";
import { createDefaultTemplateContent } from "@templatical/types";
import { AI_RECORDINGS, createMockAiProvider, createMockTranslationProvider } from "@templatical/ai-kit/testing";
import "@templatical/editor/style.css";

// In-memory storage for this example; replace with your backend.
let template = { id: "languages", content: createDefaultTemplateContent() };
const translations = {
  "de": {
    "languages-title/content": "<p>Willkommen zur Herbstkollektion</p>",
    "languages-hero/alt": "Ein tragbarer Lautsprecher",
    "languages-copy/content": "<p>Entdecken Sie unsere neue Kollektion.</p>",
    "languages-stale/content": "<p>Das Angebot endet am Freitag.</p>",
    "languages-us-only/content": "<p>Kostenloser Versand in den USA.</p>",
    "languages-tagged/content": "<p>Hallo <x id=\"1\"/>.</p>"
  },
  "fr": {
    "languages-title/content": "<p>Bienvenue dans la collection d’automne</p>",
    "languages-hero/alt": "Une enceinte portable",
    "languages-copy/content": "<p>Découvrez notre nouvelle collection.</p>",
    "languages-stale/content": "<p>L’offre se termine vendredi.</p>",
    "languages-us-only/content": "<p>Livraison gratuite aux États-Unis.</p>",
    "languages-tagged/content": "<p>Bonjour <x id=\"1\"/>.</p>"
  }
};
const editor = await init({
  container: document.getElementById("editor"),
  templates: {
    load: async () => template,
    create: false,
    save: async (id, patch) => (template = { ...template, ...patch, id }),
  },
  layout: {
  "blocks": [
    {
      "id": "languages-layout",
      "type": "wrapper",
      "children": [
        {
          "id": "languages-slot",
          "type": "slot",
          "styles": {
            "padding": {
              "top": 0,
              "right": 0,
              "bottom": 0,
              "left": 0
            }
          }
        },
        {
          "id": "languages-footer",
          "type": "paragraph",
          "content": "<p>Unsubscribe</p>",
          "styles": {
            "padding": {
              "top": 10,
              "right": 10,
              "bottom": 10,
              "left": 10
            }
          },
          "l10n": {
            "de": {
              "text": {
                "content": {
                  "value": "<p>Abmelden</p>",
                  "sourceHash": "33879b8d"
                }
              }
            }
          }
        }
      ],
      "styles": {
        "padding": {
          "top": 0,
          "right": 0,
          "bottom": 0,
          "left": 0
        }
      }
    }
  ],
  "settings": {
    "width": 600,
    "backgroundColor": "#ffffff",
    "textColor": "#1a1a1a",
    "linkUnderline": true,
    "fontFamily": "Arial",
    "locale": "en",
    "locales": [
      "de"
    ]
  }
},
  localization: { locales: ["de", "fr", "ar"] },
  translation: createMockTranslationProvider({ translations }),
  ai: createMockAiProvider({
    ...AI_RECORDINGS,
    rewrite: (request) => request.locale === "de"
      ? [{ type: "done", html: "<p>Entdecken Sie die Highlights unserer Herbstkollektion.</p>" }]
      : typeof AI_RECORDINGS.rewrite === "function"
        ? AI_RECORDINGS.rewrite(request)
        : [],
  }),
});

await editor.load("languages");
```
