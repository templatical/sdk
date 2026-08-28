import type { TemplaticalEditorConfig } from "@templatical/editor";
import { controlDefault, type CapabilityDef, type ControlState } from "./types";

/**
 * Resolve a capability's config from control state.
 *
 * Missing keys are filled from each control's default first, so `build()` never
 * has to guard for `undefined` and a partially-seeded state (an e2e spec setting
 * one key) behaves the same as a fully-seeded one.
 */
export function buildCapabilityConfig(
  def: CapabilityDef,
  state: ControlState,
): Partial<TemplaticalEditorConfig> {
  const resolved: ControlState = {};
  for (const control of def.controls) {
    resolved[control.path] =
      control.path in state ? state[control.path] : controlDefault(control);
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
