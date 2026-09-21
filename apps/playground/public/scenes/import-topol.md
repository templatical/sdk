# Topol

convertTopolTemplate + init({ content }) — Topol design JSON.

Contract: https://docs.templatical.com/guide/migration-from-topol
Live: https://play.templatical.com/scenes/import-topol

## Snippet

```ts
import { convertTopolTemplate } from "@templatical/import-topol";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertTopolTemplate(design);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
