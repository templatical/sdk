import {
  savedBlocksProviderFor,
  testEmailProvider,
} from "../../host/providers";
import type { ThemeOverrides } from "@templatical/types";
import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

/**
 * A host brand (crimson) painted over the stock warm chrome: distinct from
 * both the stock amber and the teal Launchpad email the scene opens on, so
 * the theme is what visibly changed. Every value is
 * an `rgb()` string on purpose: `modal-theming.spec.ts` compares a dialog's
 * computed background, which Chrome serialises as `rgb(r, g, b)`, against the
 * raw `bgElevated` value, and no stock token (all `oklch()`) can match it.
 */
const BRAND_THEME: ThemeOverrides = {
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
};

export const theming: Scene = {
  id: "theming",
  title: "Theming",
  job: "Paint the chrome your colors",
  initKey: "theme",
  summary:
    "init({ theme }) — ThemeOverrides reach the editor root and teleported dialogs.",
  affordance: "theme",
  catalog: "oss",
  group: "configure",
  docs: "/guide/theming",
  content: () => setupBaseCanvas(),
  config(ctx) {
    const theme = { ...BRAND_THEME };
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
});`,
};
