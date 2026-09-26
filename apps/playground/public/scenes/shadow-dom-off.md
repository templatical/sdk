# Shadow DOM off

Mount in the page light DOM

init({ shadowDom: false }) — light-DOM mount. Live e2e still uses ?shadowDom=.

Contract: https://docs.templatical.com/guide/shadow-dom#opt-out-shadowdom-false
Live: https://play.templatical.com/scenes/shadow-dom-off

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  shadowDom: false,
});
```
