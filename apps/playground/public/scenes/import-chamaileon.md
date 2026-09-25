# Chamaileon

Paste Chamaileon JSON

convertChamaileonTemplate + init({ content }) — getDocument() JSON.

Contract: https://docs.templatical.com/guide/migration-from-chamaileon#usage
Live: https://play.templatical.com/scenes/import-chamaileon

## Snippet

```ts
import { convertChamaileonTemplate } from "@templatical/import-chamaileon";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertChamaileonTemplate(chamaileonJson);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
