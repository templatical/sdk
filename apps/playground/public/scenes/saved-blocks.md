# Saved blocks

init({ savedBlocks }) — localStorage library, pick-session save, insert, rename, delete.

Contract: https://docs.templatical.com/backend/saved-blocks
Live: https://play.templatical.com/scenes/saved-blocks

## Snippet

```ts
import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:saved-blocks",
  }),
});
```
