import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateOption } from "@/templates";
import { buildCapabilityConfig } from "../build";
import {
  controlDefault,
  type AnyCapabilityDef,
  type CapabilityGroup,
  type ControlState,
  type RecordCapabilityEventFor,
} from "../types";
import { savedBlocksCapability } from "./saved-blocks";
import { templatesCapability } from "./templates";
import { versionHistoryCapability } from "./version-history";
import { commentsCapability } from "./comments";
import { testEmailCapability } from "./test-email";
import { renderCapability } from "./render";
import { shadowDomCapability } from "./shadow-dom";
import { i18nCapability } from "./i18n";

export const capabilities: AnyCapabilityDef[] = [
  savedBlocksCapability,
  templatesCapability,
  versionHistoryCapability,
  commentsCapability,
  testEmailCapability,
  renderCapability,
  shadowDomCapability,
  i18nCapability,
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
 *
 * State is resolved across the WHOLE registry before any `build()` runs, not
 * per capability. A `build()` that reads another capability's control path —
 * `version-history` reads `templates.save` — would otherwise see `undefined`
 * for a key merely absent from storage, while `isControlForced` (which the
 * drawer feeds `resolveControlState`) sees that control's default. The two
 * would then disagree for any `forcedBy` whose `when` equals its trigger's
 * own default: the drawer would disable a control and name a reason for
 * forcing that `build()` never applied.
 *
 * `record` is forwarded to every capability, which binds it to that
 * capability's own id. Omitting it yields the same config with inert
 * handlers — the shape a caller sees never depends on whether a feed exists.
 */
export function buildAllCapabilityConfig(
  state: ControlState,
  template?: TemplateOption,
  record?: RecordCapabilityEventFor,
): Partial<TemplaticalEditorConfig> {
  const resolved = resolveControlState(state);
  let merged: Partial<TemplaticalEditorConfig> = {};
  for (const def of capabilities) {
    merged = {
      ...merged,
      ...buildCapabilityConfig(def, resolved, def.implFor?.(template), record),
    };
  }
  return merged;
}

/**
 * Rail order. Backend and data comes first because it is what motivated the
 * overhaul; Cloud comes last because it is the upgrade path, not the entry point.
 */
export const CAPABILITY_GROUP_ORDER: readonly CapabilityGroup[] = [
  "backend",
  "authoring",
  "appearance",
  "cloud",
];

const GROUP_TITLES: Record<CapabilityGroup, string> = {
  backend: "Backend & data",
  authoring: "Authoring",
  appearance: "Appearance",
  cloud: "Cloud",
};

/**
 * The registry arranged for the rail: groups in {@link CAPABILITY_GROUP_ORDER},
 * each carrying its capabilities in registration order.
 *
 * A group with nothing registered is omitted rather than rendered empty — an
 * empty heading reads as a broken rail, and the groups fill in as later plans
 * port their capabilities.
 */
export function capabilityGroups(): {
  group: CapabilityGroup;
  title: string;
  capabilities: AnyCapabilityDef[];
}[] {
  return CAPABILITY_GROUP_ORDER.map((group) => ({
    group,
    title: GROUP_TITLES[group],
    capabilities: capabilities.filter((c) => c.group === group),
  })).filter((entry) => entry.capabilities.length > 0);
}
