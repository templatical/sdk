// The specimen sheet: one instance of the block per state that commonly
// breaks a custom block — defaults, every optional cleared, long copy,
// repeatables at their bounds, booleans inverted — so the live preview shows
// the edge cases without the user thinking to try them.

import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  type CustomBlockDefinition,
  type CustomBlockField,
  type TemplateContent,
} from "@templatical/types";
import type { CustomBlockWorkingFile } from "./types";

export type SpecimenState =
  "defaults" | "empty" | "long" | "min-items" | "max-items" | "flipped";
export const SPECIMEN_STATES: readonly SpecimenState[] = [
  "defaults",
  "empty",
  "long",
  "min-items",
  "max-items",
  "flipped",
];
export interface SpecimenInstance {
  state: SpecimenState;
  fieldValues: Record<string, unknown>;
}
export const DEFAULT_MAX_ITEMS = 6;

type ItemField = Exclude<CustomBlockField, { type: "repeatable" }>;
type Repeatable = Extract<CustomBlockField, { type: "repeatable" }>;

// Same fallbacks as @templatical/types' createCustomBlock, which keeps its own
// copy private; the "defaults" test holds the two equal.
function fieldDefault(f: CustomBlockField): unknown {
  if (f.default !== undefined) return structuredClone(f.default);
  if (f.type === "repeatable") return [];
  if (f.type === "boolean") return false;
  if (f.type === "number") return 0;
  return "";
}

function itemFrom(fields: ItemField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.key, fieldDefault(f)]));
}

function items(f: Repeatable, n: number): Record<string, unknown>[] {
  const seeds =
    Array.isArray(f.default) && f.default.length > 0
      ? f.default
      : [itemFrom(f.fields)];
  return Array.from({ length: n }, (_, i) =>
    structuredClone(seeds[i % seeds.length]),
  );
}

function lengthen(f: CustomBlockField, v: unknown): unknown {
  if (f.type === "text" || f.type === "textarea") {
    const base = (typeof v === "string" && v) || f.placeholder || f.label;
    return [base, base, base].join(" ");
  }
  if (f.type === "number") return f.max ?? v;
  if (f.type === "repeatable" && Array.isArray(v)) {
    return v.map((item: Record<string, unknown>) =>
      Object.fromEntries(
        f.fields.map((s) => [s.key, lengthen(s, item[s.key])]),
      ),
    );
  }
  return v;
}

function clear(f: CustomBlockField, v: unknown): unknown {
  if (f.required) return v;
  if (f.type === "boolean") return false;
  if (f.type === "number") return null;
  if (f.type === "repeatable") return items(f, f.minItems ?? 0);
  return "";
}

export function buildSpecimen(def: CustomBlockWorkingFile): SpecimenInstance[] {
  const defaults = createCustomBlock(def as CustomBlockDefinition).fieldValues;
  const map = (fn: (f: CustomBlockField, v: unknown) => unknown) =>
    Object.fromEntries(
      def.fields.map((f) => [f.key, fn(f, structuredClone(defaults[f.key]))]),
    );

  const out: SpecimenInstance[] = [
    { state: "defaults", fieldValues: structuredClone(defaults) },
    { state: "empty", fieldValues: map(clear) },
    { state: "long", fieldValues: map(lengthen) },
  ];
  const repeatables = def.fields.filter(
    (f): f is Repeatable => f.type === "repeatable",
  );
  if (repeatables.length > 0) {
    const sized = (pick: (f: Repeatable) => number) => ({
      ...structuredClone(defaults),
      ...Object.fromEntries(repeatables.map((f) => [f.key, items(f, pick(f))])),
    });
    out.push({
      state: "min-items",
      fieldValues: sized((f) => f.minItems ?? 0),
    });
    out.push({
      state: "max-items",
      fieldValues: sized((f) => f.maxItems ?? DEFAULT_MAX_ITEMS),
    });
  }
  const booleans = def.fields.filter((f) => f.type === "boolean");
  if (booleans.length > 0) {
    out.push({
      state: "flipped",
      fieldValues: {
        ...structuredClone(defaults),
        ...Object.fromEntries(booleans.map((f) => [f.key, !defaults[f.key]])),
      },
    });
  }
  return out;
}

export function buildSpecimenTemplate(
  def: CustomBlockWorkingFile,
  host?: TemplateContent,
  only?: SpecimenState,
): TemplateContent {
  const content = host ? structuredClone(host) : createDefaultTemplateContent();
  for (const instance of buildSpecimen(def)) {
    if (only && instance.state !== only) continue;
    content.blocks.push(
      createParagraphBlock({
        content: `<p><strong>Specimen:</strong> ${instance.state}</p>`,
      }),
      {
        ...createCustomBlock(def as CustomBlockDefinition),
        fieldValues: instance.fieldValues,
      },
    );
  }
  return content;
}
