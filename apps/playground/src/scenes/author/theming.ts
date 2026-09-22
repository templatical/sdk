import {
  savedBlocksProviderFor,
  testEmailProvider,
} from "../../host/providers";
import type { Scene } from "../types";
import { emptyCanvas } from "./shared";

/** Distinctive override used by `tpl-playground-theme-override` e2e. */
const THEME_OVERRIDE = { bgElevated: "rgb(255, 0, 0)" };

export const theming: Scene = {
  id: "theming",
  title: "Theming",
  job: "Paint the chrome your colors",
  summary:
    "init({ theme }) — ThemeOverrides reach the editor root and teleported dialogs.",
  affordance: "theme",
  catalog: "oss",
  group: "configure",
  docs: "/guide/theming",
  content: () => emptyCanvas(),
  config(ctx) {
    const theme = { ...THEME_OVERRIDE };
    if (ctx.search.get("modals") === "1") {
      return {
        theme,
        savedBlocks: savedBlocksProviderFor("theming"),
        testEmail: testEmailProvider,
      };
    }
    return { theme };
  },
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  theme: {
    bgElevated: "rgb(255, 0, 0)",
  },
});`,
};
