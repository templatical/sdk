# Merge tag samples

Preview with sample values

init({ mergeTags }) with MergeTag.sample — preview substitutes, no resolver.

Contract: https://docs.templatical.com/guide/preview-rendering#sample-values
Live: https://play.templatical.com/scenes/merge-tags-samples

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada" },
      { label: "Last Name", value: "{{last_name}}" },
    ],
  },
});
```
