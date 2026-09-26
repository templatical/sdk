# Minimum setup

Empty canvas, nothing wired

init({ container }) — empty canvas, no providers.

Contract: https://docs.templatical.com/getting-started/quick-start#mount-the-editor
Live: https://play.templatical.com/scenes/minimum

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
});
```
