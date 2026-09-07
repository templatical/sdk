import type { CapabilityDef } from "../types";

/** The control the shell reads to key its host element. */
export const SHADOW_DOM_PATH = "shadowDom.mode";

/**
 * How the editor mounts: inside a shadow root, or in the host page's DOM.
 *
 * Wraps no provider — one `init()` key, driven by one control. Typed
 * `CapabilityDef<undefined>` rather than `CapabilityDef<never>`: `build`'s
 * `impl` really is always `undefined` here (never populated, but not an
 * impossible value either), and `never` fails to typecheck against
 * `AnyCapabilityDef` — `build`'s `impl` parameter is contravariant, and `any`
 * is not assignable to `never`, so a `CapabilityDef<never>` cannot join the
 * registry's `AnyCapabilityDef[]` array at all.
 */
export const shadowDomCapability: CapabilityDef<undefined> = {
  id: "shadow-dom",
  group: "appearance",
  title: "Shadow DOM",
  blurb:
    "The editor mounts in a shadow root so host page CSS cannot reach it; light DOM is the opt-out.",
  fixture: "product-launch",
  controls: [
    {
      kind: "enum",
      path: SHADOW_DOM_PATH,
      label: "mount mode",
      help: "Shadow isolates the editor from host page CSS. Light DOM keeps the older browser floor and lets host code query into the editor.",
      options: ["shadow", "light"],
      default: "shadow",
    },
  ],
  build: (state) => ({ shadowDom: state[SHADOW_DOM_PATH] !== "light" }),
};
