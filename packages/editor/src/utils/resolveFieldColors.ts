import type { CustomBlockColorField } from "@templatical/types";
import {
  DEFAULT_RESOLVED_COLORS,
  resolveColorsConfig,
  type ResolvedColors,
} from "./resolveColorsConfig";

/**
 * The palette one custom-block color field renders, plus the audit signals a
 * consumer needs to warn about a field config that could not be honoured.
 *
 * Pure — this util never logs. The warnings live at the definition-registration
 * site (`useEditorCore`, via `collectColorFieldIssues`), the same resolver /
 * consumer split `resolveColorsConfig` and `resolvePaletteBlocks` use.
 */
export interface ResolvedFieldColors {
  /** The preset grid this field's picker renders. */
  presets: string[];
  /** Whether the wheel + hex input are offered alongside the grid. */
  allowCustom: boolean;
  /**
   * Entries of the FIELD's own `presets` dropped as invalid hex. Never includes
   * anything inherited from the editor palette — those were already validated
   * (and already warned about) at the editor level, so they are not re-reported.
   */
  invalidPresets: string[];
  /** The field declared `presets: []` — an empty list cannot narrow anything. */
  emptyPresets: boolean;
  /**
   * The field contributed no usable presets (unset, empty, or all-invalid), so
   * {@link ResolvedFieldColors.presets} is the editor's palette.
   */
  presetsInherited: boolean;
  /**
   * The field asked for `allowCustom: true` while the editor is locked. A field
   * may only narrow, so the request is dropped and the field stays locked.
   */
  allowCustomIgnored: boolean;
}

/**
 * Resolve a custom-block color field's own `presets` / `allowCustom` against
 * the already-resolved editor-wide palette. **Narrowing only** — a field can
 * restrict what the editor-wide `colors` config offers, never widen it:
 *
 * - `allowCustom` — locked stays locked. `editorResolved.allowCustom === false`
 *   wins outright, so an explicit field `allowCustom: true` under a locked
 *   editor is ignored (flagged via `allowCustomIgnored`). Otherwise the field's
 *   value applies, falling back to the editor's.
 * - `presets` — the field's entries are validated by {@link resolveColorsConfig}
 *   (against the unconfigured baseline, so the hex rule lives in exactly one
 *   place and inheritance is decided here rather than by that util's generic
 *   per-property precedence). A non-empty valid list replaces the editor's;
 *   unset, `[]`, or all-invalid all inherit the editor's palette. This is why
 *   `[]` cannot mean "no chips" — an empty grid on a locked field would leave
 *   the picker with nothing to pick.
 *
 * One residual case is left to `ColorPicker`'s own guard rather than forced
 * here: a field locking itself (`allowCustom: false`) when neither it nor the
 * editor has presets resolves to `{ presets: [], allowCustom: false }`, and the
 * picker's `showFreeform = allowCustom || !hasPresets` still renders the wheel,
 * so the field is never left unable to set a color.
 */
export function resolveFieldColors(
  field: Pick<CustomBlockColorField, "presets" | "allowCustom">,
  editorResolved: ResolvedColors,
): ResolvedFieldColors {
  // Validate the field's own presets through the shared resolver, against the
  // unconfigured baseline — NOT against `editorResolved`, whose per-property
  // precedence would inherit before we can tell "field said nothing" apart
  // from "field said something unusable".
  const own = resolveColorsConfig(
    { presets: field.presets },
    DEFAULT_RESOLVED_COLORS,
  );

  const presetsInherited = own.presets.length === 0;

  const requestedAllowCustom = field.allowCustom ?? editorResolved.allowCustom;

  return {
    presets: presetsInherited ? editorResolved.presets : own.presets,
    allowCustom:
      editorResolved.allowCustom === false ? false : requestedAllowCustom,
    invalidPresets: own.invalidPresets,
    emptyPresets: field.presets !== undefined && field.presets.length === 0,
    presetsInherited,
    allowCustomIgnored:
      field.allowCustom === true && editorResolved.allowCustom === false,
  };
}
