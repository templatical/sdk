# Layout

Wrap every email in your shell

init({ layout }) — your shell wraps the email in preview and export, never in saved JSON.

Contract: https://docs.templatical.com/guide/layout
Live: https://play.templatical.com/scenes/layout

## Snippet

```ts
import {
  init,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
} from "@templatical/editor";
import "@templatical/editor/style.css";

const shell = createDefaultTemplateContent();
shell.settings.backgroundColor = "#f3f4f6";
shell.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">View in browser</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: "#ffffff",
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Imprint</a></p>',
  }),
];

const editor = await init({
  container: document.getElementById("editor"),
  layout: shell,
  sectionWrapper: false,
});
```
