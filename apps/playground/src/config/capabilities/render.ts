import { compileMjmlDemo } from "@/providers/render";
import type { CapabilityDef } from "../types";

/**
 * MJML → HTML compilation, the cheap tier of the render provider contract.
 *
 * Wraps no provider — `CapabilityDef<undefined>`, the same shape
 * `shadowDomCapability` uses. Every `RenderProvider` member is plain-optional
 * (`compileMjml?(mjml): Promise<string>`, `packages/types/src/render.ts`),
 * with no `false` in the union, so there is no per-template instance to
 * memoise through `implFor` the way the four storage providers need — one
 * control drives one key directly.
 *
 * Only `compileMjml` is offered, deliberately: MJML rendering stays local
 * through the SDK's own `@templatical/renderer`, and this one function is
 * what turns it into HTML — the tier a consumer with no Node backend can
 * still reach. `toMjml` / `toHtml` controls would demonstrate a tier this
 * demo does not otherwise model.
 */
export const renderCapability: CapabilityDef<undefined> = {
  id: "render",
  group: "backend",
  title: "Render",
  blurb:
    "Compile the editor's MJML to HTML through your own backend, or any off-the-shelf mjml2html endpoint.",
  fixture: "product-launch",
  controls: [
    {
      kind: "boolean",
      path: "render.compileMjml",
      label: "compileMjml",
      help: "Off omits the key entirely rather than setting it false — RenderProvider's methods are plain-optional, with no false in their union.",
      default: true,
    },
  ],
  build: (state) => ({
    // `render.toHtml` → `toMjml()` + `render.compileMjml` → throw is the
    // resolution order `editor.toHtml()` runs (`packages/editor/src/index.ts`).
    // An omitted key reaches that throw exactly like a present key would
    // reach it if the type allowed `false` — which it doesn't, so omitting is
    // the only off-state this contract has.
    render:
      state["render.compileMjml"] === true
        ? { compileMjml: compileMjmlDemo }
        : {},
  }),
};
