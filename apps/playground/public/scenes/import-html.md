# HTML

Paste table-based HTML

convertHtmlTemplate + init({ content }) — table-based email HTML.

Contract: https://docs.templatical.com/guide/migration-from-html#usage
Live: https://play.templatical.com/scenes/import-html

## Snippet

```ts
import { convertHtmlTemplate } from "@templatical/import-html";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertHtmlTemplate(html);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
