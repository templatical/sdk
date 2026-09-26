# Defaults

New blocks stay on-brand

init({ blockDefaults, templateDefaults }) — brand-new blocks start on-brand.

Contract: https://docs.templatical.com/guide/defaults#block-defaults
Live: https://play.templatical.com/scenes/defaults

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  blockDefaults: {
    button: { backgroundColor: "#0f766e" },
  },
  templateDefaults: {
    backgroundColor: "#f8fafc",
  },
});
```
