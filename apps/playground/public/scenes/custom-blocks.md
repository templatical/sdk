# Custom blocks

init({ customBlocks }) — one registered block on the palette.

Contract: https://docs.templatical.com/guide/custom-blocks
Live: https://play.templatical.com/scenes/custom-blocks

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  customBlocks: [
    {
      type: "testimonial",
      name: "Testimonial",
      fields: [
        { type: "textarea", key: "quote", label: "Quote", required: true },
        { type: "text", key: "authorName", label: "Author Name", required: true },
      ],
      template: "<div>{{ quote }} — {{ authorName }}</div>",
    },
  ],
});
```
