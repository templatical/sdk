import {
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
  type BlockDefaults,
  type TemplateDefaults,
} from "@templatical/types";
import { canonicalizeHexColor } from "./color";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Audit the effective block/template default colours against a preset palette
 * and return the ones that fall OUTSIDE it, as `type.key: value` descriptors —
 * e.g. `button.backgroundColor: #333333`; template-level keys as
 * `template.textColor: #1a1a1a`.
 *
 * "Effective" defaults are the factory defaults ({@link DEFAULT_BLOCK_DEFAULTS} /
 * {@link DEFAULT_TEMPLATE_DEFAULTS}) with the consumer's per-block / template
 * overrides spread on top. This is a shallow per-block spread, which for these
 * flat colour keys (`backgroundColor`, `color`, `digitColor`, …) resolves to
 * exactly the value the factory's `deepMergeDefaults` produces when it builds a
 * new block (see `packages/types/src/factory.ts` → `createBlock`) — the two
 * only diverge on nested objects, which carry no colour keys.
 *
 * A key counts as a colour when it matches `/color$/i`; its value is compared
 * through {@link canonicalizeHexColor}, so `#abc`, `#AABBCC`, and an `rgb(...)`
 * round-trip all resolve to one canonical member form. Empty-string values
 * ("no default") are skipped.
 *
 * Pure — it never logs. The consumer (`useEditorCore`, when custom colours are
 * locked) owns the warning, mirroring the resolver/consumer split used by
 * `resolveColorsConfig` and `resolvePaletteBlocks`.
 */
export function collectOffPaletteDefaults(
  presets: string[],
  blockDefaults?: BlockDefaults,
  templateDefaults?: TemplateDefaults,
): string[] {
  const palette = new Set(
    presets.map((preset) => canonicalizeHexColor(preset)),
  );
  const offenders: string[] = [];

  const collect = (source: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string") {
        if (
          value !== "" &&
          /color$/i.test(key) &&
          !palette.has(canonicalizeHexColor(value))
        ) {
          offenders.push(`${prefix}.${key}: ${value}`);
        }
      } else if (isPlainObject(value)) {
        collect(value, `${prefix}.${key}`);
      }
    }
  };

  const overrides = blockDefaults as Record<string, unknown> | undefined;
  for (const [type, factory] of Object.entries(DEFAULT_BLOCK_DEFAULTS)) {
    const override = overrides?.[type];
    collect(
      {
        ...(factory as Record<string, unknown>),
        ...(isPlainObject(override) ? override : {}),
      },
      type,
    );
  }

  collect(
    { ...DEFAULT_TEMPLATE_DEFAULTS, ...(templateDefaults ?? {}) },
    "template",
  );

  return offenders;
}
