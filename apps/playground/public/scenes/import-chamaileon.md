# Chamaileon

convertChamaileonTemplate + init({ content }) — getDocument() JSON.

Contract: https://docs.templatical.com/guide/migration-from-chamaileon
Live: https://play.templatical.com/scenes/import-chamaileon

## Snippet

```ts
import { convertChamaileonTemplate } from "@templatical/import-chamaileon";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertChamaileonTemplate(document);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
