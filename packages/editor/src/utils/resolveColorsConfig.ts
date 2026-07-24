import type { ColorsConfig } from "@templatical/types";

/**
 * Normalized color-picker configuration handed to the provide/inject layer and
 * to `ColorPicker`. `presets` defaults to an empty array and `allowCustom` to
 * `true`, so consumers never branch on `undefined`.
 *
 * `allowCustomIgnored` is a validation signal, not a rendered value: it is
 * `true` when `allowCustom: false` was requested but forced back to `true`
 * because there were no presets to fall back on. This util stays pure — it
 * never logs; the consumer that owns the config surface emits the warning
 * (today that is `useEditorCore` for the editor-level config), the same split
 * `resolvePaletteBlocks` / `Sidebar.vue` use.
 */
export interface ResolvedColors {
  presets: string[];
  allowCustom: boolean;
  allowCustomIgnored: boolean;
  /**
   * Preset entries dropped because they are not a valid `#rgb` / `#rrggbb` hex
   * string (see the validity rule on {@link resolveColorsConfig}). Collected —
   * not logged — so the config-owning consumer can warn once listing them,
   * exactly as `allowCustomIgnored` is surfaced. Reflects THIS resolution's
   * `colors.presets` input only: when a `fallback`'s already-resolved (already
   * filtered) presets are inherited, its invalids are never re-reported here.
   */
  invalidPresets: string[];
}

/**
 * The unconfigured baseline: no presets, free-form entry allowed — i.e. the
 * picker behaves exactly as it did before the `colors` option existed. Used as
 * the inject default and as the fallback for the top-level resolution.
 */
export const DEFAULT_RESOLVED_COLORS: ResolvedColors = {
  presets: [],
  allowCustom: true,
  allowCustomIgnored: false,
  invalidPresets: [],
};

/**
 * A valid preset is a `#rgb` or `#rrggbb` hex string. 4-/8-digit alpha hex is
 * deliberately rejected: the wheel (vanilla-colorful) is RGB-only,
 * `normalizeColorToHex` drops alpha on the DOM round-trip so a selected alpha
 * preset would never read back as selected, and alpha degrades unpredictably
 * across email clients.
 */
const VALID_PRESET_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Resolve a `ColorsConfig` against an already-resolved `fallback`, applying
 * precedence per property (`input` → `fallback` → default) plus the shared
 * validation rule.
 *
 * The editor-level call passes no `fallback` (it defaults to
 * {@link DEFAULT_RESOLVED_COLORS}) and its result is provided via `COLORS_KEY`.
 * The `fallback` parameter is the nested-resolution seam: a narrower config can
 * be resolved against a broader already-resolved one, inheriting whichever
 * property it does not set.
 *
 * Validation: entries in `colors.presets` that aren't valid hex
 * ({@link VALID_PRESET_HEX}) are dropped from `presets` and collected into
 * `invalidPresets` for the caller to warn about. Separately, `allowCustom:
 * false` with no presets anywhere in the chain is ignored — forced back to
 * `true`, with `allowCustomIgnored` set so the caller can warn — because
 * hiding the wheel and hex input without a preset grid would leave the picker
 * unable to set a color. Filtering runs BEFORE that guard, so an all-invalid
 * list with `allowCustom: false` cascades into the forced-true path. This
 * mirrors how `paletteBlocks` is resolved: `resolvePaletteBlocks` collects the
 * offending entries and the consumer warns; this util stays pure the same way.
 */
export function resolveColorsConfig(
  colors: ColorsConfig | undefined,
  fallback: ResolvedColors = DEFAULT_RESOLVED_COLORS,
): ResolvedColors {
  // Validate only presets this resolution actually supplies. When it inherits
  // `fallback.presets`, those were already resolved (already filtered), so
  // re-validating would double-report an upstream invalid entry.
  let presets: string[];
  let invalidPresets: string[];
  if (colors?.presets === undefined) {
    presets = fallback.presets;
    invalidPresets = [];
  } else {
    presets = [];
    invalidPresets = [];
    for (const entry of colors.presets) {
      if (VALID_PRESET_HEX.test(entry)) {
        presets.push(entry);
      } else {
        invalidPresets.push(entry);
      }
    }
  }

  const requestedAllowCustom = colors?.allowCustom ?? fallback.allowCustom;

  const allowCustomIgnored = !requestedAllowCustom && presets.length === 0;
  const allowCustom = allowCustomIgnored ? true : requestedAllowCustom;

  return { presets, allowCustom, allowCustomIgnored, invalidPresets };
}
