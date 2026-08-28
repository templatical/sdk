import type { TemplaticalEditorConfig } from "@templatical/editor";
import { controlDefault, type CapabilityDef, type ControlState } from "./types";

/**
 * Resolve a capability's config from control state.
 *
 * Each control's default fills the corresponding key only when the caller's
 * state doesn't already set it, so `build()` never has to guard for `undefined`
 * and a partially-seeded state (an e2e spec setting one key) behaves the same
 * as a fully-seeded one. Keys the capability's controls don't name — e.g. a
 * runtime value like `__impl` — pass through untouched, since `build()` may
 * read state beyond what its controls declare.
 */
export function buildCapabilityConfig(
  def: CapabilityDef,
  state: ControlState,
): Partial<TemplaticalEditorConfig> {
  const resolved: ControlState = { ...state };
  for (const control of def.controls) {
    if (!(control.path in resolved)) {
      resolved[control.path] = controlDefault(control);
    }
  }
  return def.build(resolved);
}

/**
 * A `method` control's value, resolved into what a provider key actually takes.
 *
 * `false` is a statement of intent in the provider contracts — the editor hides
 * the affordance rather than disabling it — so an off control must produce
 * literal `false`, never `undefined`, which would read as "not implemented".
 */
export function methodOr<T>(enabled: unknown, impl: T): T | false {
  return enabled === true ? impl : false;
}
