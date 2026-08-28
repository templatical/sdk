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
