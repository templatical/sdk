# Issues

Lint the template as you edit

init({ lint }) — Issues tab from @templatical/quality, an optional dependency of the editor installed by default.

Contract: https://docs.templatical.com/quality/#wire-into-the-editor
Live: https://play.templatical.com/scenes/issues

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  lint: {},
});
```
