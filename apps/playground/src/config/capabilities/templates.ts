import type { TemplatesProvider } from "@templatical/types";
import { templatesProviderFor } from "@/providers/templates";
import { methodOr } from "../build";
import type { CapabilityDef } from "../types";

/**
 * `templates.save`'s control path, exported so other capabilities that
 * compose onto it — `version-history.ts`'s `restore` — read the same string
 * this control is registered under, rather than a second copy that can drift.
 */
export const TEMPLATES_SAVE_PATH = "templates.save" as const;

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
      path: TEMPLATES_SAVE_PATH,
      label: "save",
      help: "Off hides the save button and the status indicator, and makes the name read-only.",
    },
    {
      kind: "boolean",
      path: "templates.autoSave",
      label: "autoSave",
      help: "The SDK's debounced autosave. Off by default so the Save button is visibly the thing that persists.",
      default: false,
    },
  ],
  implFor: (template) => templatesProviderFor(template),
  build: (state, impl, record) => {
    // Always defined: this capability declares `implFor`, so
    // `buildAllCapabilityConfig` never calls `build` without a live instance —
    // only a capability with no `implFor` at all ever receives `undefined`.
    impl = impl!;
    return {
      templates: {
        ...impl,
        create: methodOr(state["templates.create"], impl.create),
        save: methodOr(state[TEMPLATES_SAVE_PATH], impl.save),
        autoSave: state["templates.autoSave"] === true,
        // The demo store's own onSaved (`@/providers/templates.ts`) records the
        // save trigger onto `window` for `template-save-triggers.spec.ts` — this
        // composes with it rather than replacing it, so that keeps working
        // alongside reporting to the drawer's feed. The trigger distinguishes a
        // pressed Save from autosave, which is what a reader of the feed wants
        // to know, so it rides in the summary rather than sitting only in the
        // payload.
        onSaved: (template, meta) => {
          impl.onSaved?.(template, meta);
          record({
            handler: "onSaved",
            summary: `${template.name ?? template.id} (${meta.trigger})`,
            payload: { template, meta },
          });
        },
        onCreated: (template) =>
          record({
            handler: "onCreated",
            summary: template.name ?? template.id,
            payload: template,
          }),
        onLoaded: (template) =>
          record({
            handler: "onLoaded",
            summary: template.name ?? template.id,
            payload: template,
          }),
      },
    };
  },
};
