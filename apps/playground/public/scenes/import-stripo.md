# Stripo

Paste Stripo HTML

convertStripoTemplate + init({ content }) — Stripo HTML or { html, css }.

Contract: https://docs.templatical.com/guide/migration-from-stripo
Live: https://play.templatical.com/scenes/import-stripo

## Snippet

```ts
import { convertStripoTemplate } from "@templatical/import-stripo";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertStripoTemplate(html);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
