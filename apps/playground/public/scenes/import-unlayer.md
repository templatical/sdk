# Unlayer

convertUnlayerTemplate + init({ content }) — Unlayer saveDesign JSON.

Contract: https://docs.templatical.com/guide/migration-from-unlayer
Live: https://play.templatical.com/scenes/import-unlayer

## Snippet

```ts
import { convertUnlayerTemplate } from "@templatical/import-unlayer";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertUnlayerTemplate(unlayerJson);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
