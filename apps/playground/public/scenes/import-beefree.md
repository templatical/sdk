# BeeFree

Paste BeeFree JSON

convertBeeFreeTemplate + init({ content }) — BeeFree page.rows JSON.

Contract: https://docs.templatical.com/guide/migration-from-beefree#usage
Live: https://play.templatical.com/scenes/import-beefree

## Snippet

```ts
import { convertBeeFreeTemplate } from "@templatical/import-beefree";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertBeeFreeTemplate(beefreeJson);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
