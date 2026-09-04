import type { TemplaticalEditorConfig } from "@templatical/editor";

/** Flat map keyed by `Control.path`. Values are whatever that control holds. */
export type ControlState = Record<string, unknown>;

interface ControlBase {
  /** Dotted key into the config this control governs, e.g. `savedBlocks.update`. */
  path: string;
  label: string;
  /** One sentence shown under the control. Not a paragraph. */
  help: string;
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
