# Fonts

Limit the type menu

init({ fonts: { builtIns } }) — restrict the picker to an on-brand allowlist.

Contract: https://docs.templatical.com/guide/fonts
Live: https://play.templatical.com/scenes/fonts

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  fonts: {
    builtIns: ["Georgia", "Times New Roman", "Arial"],
  },
});
```
