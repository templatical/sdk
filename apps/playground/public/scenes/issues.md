# Issues

Lint the template as you edit

init({ lint }) — Issues tab from the optional @templatical/quality peer.

Contract: https://docs.templatical.com/quality/#wire-into-the-editor
Live: https://play.templatical.com/scenes/issues

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
// pnpm add @templatical/quality

const editor = await init({
  container: document.getElementById("editor"),
  lint: {},
});
```
