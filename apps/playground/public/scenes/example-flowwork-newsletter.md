# Flowwork newsletter

Composed Flowwork weekly: curated fonts, a featured-article custom block, and saved blocks.

Contract: https://docs.templatical.com/guide/examples#flowwork-newsletter
Live: https://play.templatical.com/scenes/example-flowwork-newsletter

## Snippet

```ts
import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada", group: "Recipient", description: "Personalized greeting at the top of the email" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient", description: "Recipient family name" },
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient", description: "Primary contact address" },
      { label: "Unsubscribe URL", value: "{{unsubscribe_url}}", sample: "https://example.com/unsubscribe", group: "System" },
    ],
  },
  fonts: {
    builtIns: ["Georgia", "Times New Roman", "Arial"],
  },
  customBlocks: [
    {
      type: "featured-article",
      name: "Featured Article",
      fields: [
        { type: "text", key: "title", label: "Title", readOnly: true },
        { type: "textarea", key: "excerpt", label: "Excerpt", readOnly: true },
      ],
      template: "<div>{{ title }}</div>",
    },
  ],
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:flowwork-newsletter",
  }),
});
```
