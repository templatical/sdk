# Theming

Paint the chrome your colors

init({ theme }) — ThemeOverrides reach the editor root and teleported dialogs.

Contract: https://docs.templatical.com/guide/theming
Live: https://play.templatical.com/scenes/theming

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  theme: {
    bgElevated: "rgb(255, 0, 0)",
  },
});
```
