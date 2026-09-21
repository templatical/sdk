# Media

init({ media }) — Browse, drop-upload, and a seeded localStorage gallery.

Contract: https://docs.templatical.com/backend/media
Live: https://play.templatical.com/scenes/media

## Snippet

```ts
import { init, createLocalStorageMediaProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  media: createLocalStorageMediaProvider({
    key: "templatical:media",
  }),
});
```
