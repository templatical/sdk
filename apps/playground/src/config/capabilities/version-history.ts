import type { VersionHistoryProvider } from "@templatical/types";
import { methodOr } from "../build";
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
  build: (state, impl) => ({
    versionHistory: {
      ...impl,
      restore: methodOr(state["versionHistory.restore"], impl.restore),
    },
  }),
};
