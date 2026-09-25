import { productLaunchSavedBlocks } from "../../templates";
import { savedBlocksProviderFor } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const savedBlocks: Scene = {
  id: "saved-blocks",
  title: "Saved blocks",
  job: "Bookmark a reusable group",
  initKey: "savedBlocks",
  summary:
    "init({ savedBlocks }) — localStorage library, pick-session save, insert, rename, delete.",
  affordance: "bookmark",
  catalog: "oss",
  group: "backend",
  docs: "/backend/saved-blocks",
  content: () => storageCanvas(),
  config(ctx) {
    const readonly = ctx.search.get("readonly") === "1";
    const delay = Number(ctx.search.get("delay") ?? "0");
    return {
      savedBlocks: savedBlocksProviderFor("saved-blocks", {
        readonly,
        delay,
        seed: productLaunchSavedBlocks,
      }),
    };
  },
  snippet: `import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:saved-blocks",
  }),
});`,
  variants: [
    { name: "Read-only", query: { readonly: "1" } },
    { name: "Slow list", query: { delay: "2000" } },
  ],
};
