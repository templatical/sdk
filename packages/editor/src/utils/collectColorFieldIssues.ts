import type {
  CustomBlockColorField,
  CustomBlockDefinition,
} from "@templatical/types";
import { canonicalizeHexColor } from "./color";
import type { ResolvedColors } from "./resolveColorsConfig";
import { resolveFieldColors } from "./resolveFieldColors";

/**
 * One problem found in a custom-block definition's color fields, ready to log.
 *
 * `id` is the once-guard key: `<block type>:<field path>:<kind>`. The same
 * field renders on every block instance, every toolbar mount, and every
 * repeater item, so the consumer keys a `Set` on this to warn once per
 * definition rather than once per render (the same guard `Sidebar.vue` uses
 * for unknown `paletteBlocks` entries).
 */
export interface ColorFieldIssue {
  id: string;
  message: string;
}

/**
 * Audit every color field of a custom-block definition against the resolved
 * editor-wide palette, returning the field configs that could not be honoured.
 *
 * Covers four cases, all of which resolve to *something* renderable (nothing
 * here throws or blocks registration) but none of which do what the author
 * wrote: invalid preset entries, an empty `presets: []`, an `allowCustom: true`
 * that can't unlock a locked editor, and a `default` colour the field's own
 * locked palette can't reselect. The last mirrors the editor-wide off-palette
 * defaults audit (`collectOffPaletteDefaults`): `createCustomBlock` seeds
 * `fieldValues[key] = field.default ?? ""` (and `RepeatableField` does the same
 * per item), so an off-palette default paints new blocks a colour the locked
 * picker offers no chip for.
 *
 * Pure — it never logs; the caller owns the warning and the once-guard.
 */
export function collectColorFieldIssues(
  definition: CustomBlockDefinition,
  editorColors: ResolvedColors,
): ColorFieldIssue[] {
  const issues: ColorFieldIssue[] = [];

  const audit = (field: CustomBlockColorField, path: string): void => {
    const resolved = resolveFieldColors(field, editorColors);
    // Both the block type and the field path are named: field keys like
    // `accentColor` repeat across definitions, so the key alone can't tell an
    // author which block to fix.
    const at = `custom block "${definition.type}" field "${path}"`;
    const id = (kind: string): string => `${definition.type}:${path}:${kind}`;

    if (resolved.invalidPresets.length > 0) {
      issues.push({
        id: id("invalid-presets"),
        message:
          `${at}: presets skipped invalid entries: ` +
          `${resolved.invalidPresets.join(", ")} — presets must be hex ` +
          "colors (#rgb or #rrggbb)." +
          (resolved.presetsInherited
            ? " No valid entries are left, so the field inherits colors.presets."
            : ""),
      });
    }

    if (resolved.emptyPresets) {
      issues.push({
        id: id("empty-presets"),
        message:
          `${at}: presets is empty — a field palette can only narrow the ` +
          "editor's, so an empty list is ignored and the field inherits " +
          "colors.presets.",
      });
    }

    if (resolved.allowCustomIgnored) {
      issues.push({
        id: id("allow-custom-ignored"),
        message:
          `${at}: allowCustom: true is ignored because colors.allowCustom ` +
          "is false — a field can narrow the editor-wide palette, never " +
          "unlock it.",
      });
    }

    // Only meaningful while locked: with the wheel available the author can
    // always get back to an off-palette default. Same gate as the editor-wide
    // audit. A field locked with no palette at all falls back to the wheel
    // (see `resolveFieldColors`), so it is exempt too.
    if (!resolved.allowCustom && resolved.presets.length > 0) {
      const seeded = field.default ?? "";
      const palette = new Set(
        resolved.presets.map((preset) => canonicalizeHexColor(preset)),
      );
      // "" seeds the unset state, which the locked grid's leading none chip
      // reselects — not an offence.
      if (seeded !== "" && !palette.has(canonicalizeHexColor(seeded))) {
        issues.push({
          id: id("off-palette-default"),
          message:
            `${at} locks custom colours, but its default ${seeded} falls ` +
            `outside the field's presets: ${resolved.presets.join(", ")}. ` +
            "New blocks start on a colour the picker can't reselect — set " +
            "the default from the same palette.",
        });
      }
    }
  };

  for (const field of definition.fields) {
    if (field.type === "color") {
      audit(field, field.key);
    } else if (field.type === "repeatable") {
      // Repeater sub-fields render one picker per item, so they need the same
      // audit — reported under a `parent[].child` path to stay distinct from a
      // top-level field of the same key.
      for (const subField of field.fields) {
        if (subField.type === "color") {
          audit(subField, `${field.key}[].${subField.key}`);
        }
      }
    }
  }

  return issues;
}
