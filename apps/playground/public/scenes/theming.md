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
    primary: "rgb(190, 18, 60)",
    primaryHover: "rgb(159, 18, 57)",
    primaryLight: "rgb(255, 228, 230)",
    bgElevated: "rgb(251, 244, 245)",
    bgHover: "rgb(246, 234, 236)",
    border: "rgb(236, 218, 222)",
    canvasBg: "rgb(248, 239, 241)",
    dark: {
      primary: "rgb(251, 113, 133)",
      primaryHover: "rgb(253, 164, 175)",
      primaryLight: "rgb(76, 5, 25)",
      bgElevated: "rgb(34, 20, 24)",
      bgHover: "rgb(46, 27, 32)",
      border: "rgb(64, 38, 45)",
      canvasBg: "rgb(20, 11, 14)",
    },
  },
});
```
