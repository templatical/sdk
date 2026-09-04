import type { VersionHistoryProvider } from "@templatical/types";
import { methodOr } from "../build";
import { TEMPLATES_SAVE_PATH } from "./templates";
import type { CapabilityDef } from "../types";

/**
 * Past states of the template. The provider arrives as `build`'s second
 * argument because it is memoised per template in `@/providers/version-history`.
 */
export const versionHistoryCapability: CapabilityDef<VersionHistoryProvider> = {
  id: "version-history",
  group: "backend",
  title: "Version history",
  blurb:
    "Every save records a version; the editor browses and previews them, and you own the store.",
  fixture: "product-launch",
  controls: [
    {
      kind: "method",
      path: "versionHistory.restore",
      label: "restore",
      help: "Off removes the Restore button. History stays browsable and previewable.",
    },
  ],
  build: (state, impl) => {
    // The demo's restore() (@/providers/version-history) composes onto the
    // templates store's own save — there is no atomic restore endpoint, so it
    // reads the old content and saves it. A store that refuses save has
    // nothing for restore to write to, so a withheld templates.save forces
    // restore off here too, regardless of this capability's own control.
    const restore =
      state[TEMPLATES_SAVE_PATH] === false
        ? false
        : methodOr(state["versionHistory.restore"], impl.restore);
    return {
      versionHistory: {
        ...impl,
        restore,
      },
    };
  },
};
