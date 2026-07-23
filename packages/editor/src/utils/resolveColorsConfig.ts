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
};

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
 * Validation: `allowCustom: false` with no presets anywhere in the chain is
 * ignored — forced back to `true`, with `allowCustomIgnored` set so the caller
 * can warn — because hiding the wheel and hex input without a preset grid would
 * leave the picker unable to set a color. This mirrors how `paletteBlocks` is
 * resolved: `resolvePaletteBlocks` collects the offending entries and the
 * consumer warns; this util stays pure the same way.
 */
export function resolveColorsConfig(
  colors: ColorsConfig | undefined,
  fallback: ResolvedColors = DEFAULT_RESOLVED_COLORS,
): ResolvedColors {
  const presets = colors?.presets ?? fallback.presets;
  const requestedAllowCustom = colors?.allowCustom ?? fallback.allowCustom;

  const allowCustomIgnored = !requestedAllowCustom && presets.length === 0;
  const allowCustom = allowCustomIgnored ? true : requestedAllowCustom;

  return { presets, allowCustom, allowCustomIgnored };
}
