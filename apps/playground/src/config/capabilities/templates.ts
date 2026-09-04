import type { TemplatesProvider } from "@templatical/types";
import { methodOr } from "../build";
import type { CapabilityDef } from "../types";

/**
 * The template's own save/load lifecycle. The provider arrives as `build`'s
 * second argument because it is memoised per template in `@/providers/templates`.
 */
export const templatesCapability: CapabilityDef<TemplatesProvider> = {
  id: "templates",
  group: "backend",
  title: "Templates",
  blurb:
    "The editor owns the name field, save button and save status; you own where the template is stored.",
  fixture: "product-launch",
  controls: [
    {
      kind: "method",
      path: "templates.create",
      label: "create",
      help: "Off makes editor.create() reject. It hides nothing — the editor has no create affordance.",
    },
    {
      kind: "method",
      path: "templates.save",
      label: "save",
      help: "Off hides the save button and the status indicator, and makes the name read-only.",
    },
  ],
  build: (state, impl) => ({
    templates: {
      ...impl,
      create: methodOr(state["templates.create"], impl.create),
      save: methodOr(state["templates.save"], impl.save),
    },
  }),
};
