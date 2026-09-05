import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateOption } from "@/templates";

/** Flat map keyed by `Control.path`. Values are whatever that control holds. */
export type ControlState = Record<string, unknown>;

/**
 * A declaration that another control's value forces this one.
 *
 * The forcing itself is applied by the owning capability's `build()`; this
 * describes it so a UI can disable the control and name the reason instead of
 * rendering a toggle that visibly does nothing. The two must agree — a test
 * pins every declaration against what `build()` actually produces.
 */
export interface ForcedBy {
  /** The control path whose value does the forcing. */
  path: string;
  /** The trigger value. Forcing applies when the state at `path` equals this. */
  when: unknown;
  /** The value this control is forced to while the trigger holds. */
  to: unknown;
  /** One sentence naming the responsible control and why it matters. */
  reason: string;
}

interface ControlBase {
  /** Dotted key into the config this control governs, e.g. `savedBlocks.update`. */
  path: string;
  label: string;
  /** One sentence shown under the control. Not a paragraph. */
  help: string;
  /** Set when another control's value overrides this one. See {@link ForcedBy}. */
  forcedBy?: ForcedBy;
}

/**
 * Toggles a provider method between its real implementation and literal `false`.
 * This is the control the whole design exists for: flipping it makes the editor
 * hide the affordance, and the config view shows `false`.
 */
export interface MethodControl extends ControlBase {
  kind: "method";
  /** Default is `true` (the method is supplied). */
  default?: boolean;
}

export interface BooleanControl extends ControlBase {
  kind: "boolean";
  default?: boolean;
}

export interface NumberControl extends ControlBase {
  kind: "number";
  min: number;
  max: number;
  default?: number;
}

export interface EnumControl extends ControlBase {
  kind: "enum";
  options: string[];
  default?: string;
}

export interface ListControl extends ControlBase {
  kind: "list";
  default?: string[];
}

export type Control =
  MethodControl | BooleanControl | NumberControl | EnumControl | ListControl;

export type CapabilityGroup = "backend" | "authoring" | "appearance" | "cloud";

export interface CapabilityDef<TImpl = unknown> {
  id: string;
  group: CapabilityGroup;
  title: string;
  /** ONE sentence. The long-form explanation belongs in apps/docs. */
  blurb: string;
  fixture: string;
  controls: Control[];
  /**
   * Construct the live demo backend this capability's `build` needs.
   *
   * Declared here rather than paired up by the caller so the registry alone is
   * enough to produce a whole `init()` config: anything iterating `capabilities`
   * can ask each entry for its own implementation. The factories memoise per
   * template, so calling this repeatedly is cheap and returns the same instance.
   */
  implFor: (template?: TemplateOption) => TImpl;
  /**
   * Produce the editor config this capability contributes.
   *
   * `impl` is the live demo backend — memoised per template, holding
   * localStorage and closures. It arrives as an argument rather than inside
   * `state` so `ControlState` stays JSON-serializable: the config drawer
   * persists control state, and a provider cannot survive that round-trip.
   */
  build: (state: ControlState, impl: TImpl) => Partial<TemplaticalEditorConfig>;
}

/**
 * A capability of unknown implementation type, for the registry.
 *
 * `build`'s `impl` parameter is contravariant, so `CapabilityDef<unknown>`
 * would reject every concrete capability. The registry only ever passes its
 * entries to `buildCapabilityConfig`, which re-ties `TImpl` at the call site.
 */
export type AnyCapabilityDef = CapabilityDef<any>;

/** The value a control holds when its state key is absent. */
export function controlDefault(control: Control): unknown {
  switch (control.kind) {
    case "method":
      return control.default ?? true;
    case "boolean":
      return control.default ?? false;
    case "number":
      return control.default ?? control.min;
    case "enum":
      return control.default ?? control.options[0];
    case "list":
      return control.default ?? [];
  }
}

/**
 * Whether `control` is currently overridden by the control it declares in
 * `forcedBy`. A control with no declaration is never forced.
 *
 * Compares `state[forcedBy.path]` against `forcedBy.when` exactly as given —
 * it does not fill in a missing key with that trigger control's own default.
 * Pass state whose defaults are already resolved (`resolveControlState` in
 * `./capabilities`), so a trigger key that is merely absent and one
 * explicitly set to that control's own default compare the same way here as
 * they do under `buildAllCapabilityConfig`, which resolves the whole registry
 * before any `build()` runs. `buildCapabilityConfig` called on its own
 * resolves only that one capability's controls, so a cross-capability
 * comparison against its state is not the same thing. This function stays
 * free of the registry on purpose: resolving state is the caller's job.
 * `./capabilities` already imports this module for `ControlState` and
 * `controlDefault`; importing the registry back from here would form a
 * cycle between the two files.
 */
export function isControlForced(
  control: Control,
  state: ControlState,
): boolean {
  const forcedBy = control.forcedBy;
  if (!forcedBy) return false;
  return state[forcedBy.path] === forcedBy.when;
}
