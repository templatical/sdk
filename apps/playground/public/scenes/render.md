# Render

Export MJML and HTML

init({ render: { compileMjml } }) — editor.toMjml() locally, toHtml() through one compiler.

Contract: https://docs.templatical.com/backend/render
Live: https://play.templatical.com/scenes/render

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  render: {
    // replace with your API
    compileMjml: async (mjml) => {
      const res = await fetch("/api/mjml", { method: "POST", body: mjml });
      return res.text();
    },
  },
});

const mjml = await editor.toMjml();
const html = await editor.toHtml();
```
