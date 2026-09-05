import type { TemplaticalEditorConfig } from "@templatical/editor";
import {
  controlDefault,
  type CapabilityDef,
  type ControlState,
  type RecordCapabilityEventFor,
} from "./types";

/**
 * Resolve a capability's config from control state and its live implementation.
 *
 * Each control's default fills the corresponding key only when the caller's
 * state doesn't already set it, so `build()` never has to guard for `undefined`
 * and a partially-seeded state (an e2e spec setting one key) behaves the same
 * as a fully-seeded one. The live implementation arrives separately as `impl`,
 * never folded into `state`.
 *
 * `record` defaults to a no-op so a caller with no feed to write to — a unit
 * test, a headless build — still gets a config whose lifecycle handlers are
 * present and inert, rather than one whose shape differs from the shell's.
 */
export function buildCapabilityConfig<TImpl>(
  def: CapabilityDef<TImpl>,
  state: ControlState,
  impl: TImpl,
  record: RecordCapabilityEventFor = () => {},
): Partial<TemplaticalEditorConfig> {
  const resolved: ControlState = { ...state };
  for (const control of def.controls) {
    if (!(control.path in resolved)) {
      resolved[control.path] = controlDefault(control);
    }
  }
  // Bound here rather than passed through, so a capability cannot report under
  // another's id and the feed's grouping stays trustworthy.
  return def.build(resolved, impl, (event) => record(def.id, event));
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
