# Languages

Language versions of one template

init({ templates, localization }) enables language versions in one template. Switch to Deutsch for translated text, a different hero image, a hidden block and a stale value; Keep clears the stale marker. Add French or select Arabic for right-to-left content.

Contract: https://docs.templatical.com/guide/localized-templates
Live: https://play.templatical.com/scenes/languages

## Snippet

```ts
import { init } from "@templatical/editor";
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

await editor.load("languages");
```
