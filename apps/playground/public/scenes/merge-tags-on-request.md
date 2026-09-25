# Merge tags on request

Pick fields from your app

init({ mergeTags: { onRequest } }) — consumer-owned picker takes precedence.

Contract: https://docs.templatical.com/guide/merge-tags#dynamic-tag-loading
Live: https://play.templatical.com/scenes/merge-tags-on-request

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", group: "Recipient" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient" },
    ],
    onRequest: async () => {
      // open your own picker; return the chosen tag or null
      return await yourPicker();
    },
  },
});
```
