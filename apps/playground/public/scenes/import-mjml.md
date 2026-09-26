# MJML

Paste MJML source

convertMjmlTemplate + init({ content }) — raw MJML source.

Contract: https://docs.templatical.com/guide/migration-from-mjml#usage
Live: https://play.templatical.com/scenes/import-mjml

## Snippet

```ts
import { convertMjmlTemplate } from "@templatical/import-mjml";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertMjmlTemplate(mjml);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
