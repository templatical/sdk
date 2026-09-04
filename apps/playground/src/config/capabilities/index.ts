import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateOption } from "@/templates";
import { buildCapabilityConfig } from "../build";
import {
  controlDefault,
  type AnyCapabilityDef,
  type ControlState,
} from "../types";
import { savedBlocksCapability } from "./saved-blocks";
import { templatesCapability } from "./templates";
import { versionHistoryCapability } from "./version-history";
import { commentsCapability } from "./comments";

export const capabilities: AnyCapabilityDef[] = [
  savedBlocksCapability,
  templatesCapability,
  versionHistoryCapability,
  commentsCapability,
];

export function capabilityById(id: string): AnyCapabilityDef | undefined {
  return capabilities.find((c) => c.id === id);
}

/**
 * Fill every registered capability's control with its own default wherever
 * `state` doesn't already set it, without mutating `state`.
 *
 * `buildCapabilityConfig` (`../build`) does the equivalent per capability,
 * right before that capability's `build()` reads state. This is the
 * whole-registry version, for a caller that needs to reason about state the
 * same way `build()` eventually will, before any one capability's `build()`
 * runs — `isControlForced` (`../types`) is that caller: it compares one
 * control's state against another's `forcedBy.when`, and that comparison
 * only agrees with `build()` once both sides see the same resolved
 * defaults. Lives here for the reason `buildAllCapabilityConfig` below
 * does — this module already imports every capability, and a value import
 * of the registry back into `../types` would close a cycle.
 */
export function resolveControlState(state: ControlState): ControlState {
  const resolved: ControlState = { ...state };
  for (const def of capabilities) {
    for (const control of def.controls) {
      if (!(control.path in resolved)) {
        resolved[control.path] = controlDefault(control);
      }
    }
  }
  return resolved;
}

/**
 * Resolve every registered capability's config and merge it into one object.
 *
 * Each capability supplies its own implementation via `implFor`, so this needs
 * nothing but control state and the open template — which is what lets the
 * config panel render the whole `init()` object from the registry alone.
 *
 * Lives here rather than in `../build` because this module already imports
 * every capability to build the `capabilities` array above; `../build` stays
 * a leaf that each capability module imports `methodOr` from, and a value
 * import back from there to here would close a cycle.
 *
 * Capabilities own disjoint config keys, so a later entry cannot clobber an
 * earlier one; the key-set assertion in `tests/config-build-all.test.ts` pins
 * that they stay disjoint.
 */
export function buildAllCapabilityConfig(
  state: ControlState,
  template?: TemplateOption,
): Partial<TemplaticalEditorConfig> {
  let merged: Partial<TemplaticalEditorConfig> = {};
  for (const def of capabilities) {
    merged = {
      ...merged,
      ...buildCapabilityConfig(def, state, def.implFor(template)),
    };
  }
  return merged;
}
