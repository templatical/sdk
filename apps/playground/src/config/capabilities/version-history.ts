import type { VersionHistoryProvider } from "@templatical/types";
import { versionHistoryProviderFor } from "@/providers/version-history";
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
      forcedBy: {
        path: TEMPLATES_SAVE_PATH,
        when: false,
        to: false,
        reason:
          "templates.save is off, so restore has nothing to write the old content to.",
      },
    },
  ],
  implFor: (template) => versionHistoryProviderFor(template),
  build: (state, impl, record) => {
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
        // Fires only for a headless caller. `VersionHistoryProvider.create()`
        // has no affordance in the shipped editor — versionHistory is the one
        // provider whose `canCreate` gates nothing, and the demo's own `save()`
        // appends to the version store directly rather than through `create`,
        // which `@templatical/types` documents as deliberate ("Not called for
        // a version your `save` implementation records automatically"). Wired
        // because the contract has it; do not count it as demonstrated.
        //
        // `label` is optional — a store that lets nobody name a version has
        // none — so the id is the fallback rather than letting the row read
        // "undefined".
        onCreated: (version) =>
          record({
            handler: "onCreated",
            summary: version.label ?? version.id,
            payload: version,
          }),
        // Takes the resulting Template, not the TemplateVersion restored from.
        onRestored: (template) =>
          record({
            handler: "onRestored",
            summary: template.name ?? template.id,
            payload: template,
          }),
      },
    };
  },
};
