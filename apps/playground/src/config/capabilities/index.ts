import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateOption } from "@/templates";
import { buildCapabilityConfig } from "../build";
import type { AnyCapabilityDef, ControlState } from "../types";
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
