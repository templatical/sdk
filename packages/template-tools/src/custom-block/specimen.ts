// The specimen sheet: one instance of the block per state that commonly
// breaks a custom block — defaults, every optional cleared, long copy,
// repeatables at their bounds, booleans inverted — so the live preview shows
// the edge cases without the user thinking to try them.

import { escapeHtml } from "@templatical/renderer";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  type Block,
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
    // Never below minItems: without a maxItems, the fallback can sit under
    // the minimum, and the editor never lets a list get that short.
    out.push({
      state: "max-items",
      fieldValues: sized((f) =>
        Math.max(f.minItems ?? 0, f.maxItems ?? DEFAULT_MAX_ITEMS),
      ),
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

/** What running the data-source recipe for the live preview produced. */
export type FetchedSpecimen =
  | { ok: true; fieldValues: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * The live preview's "fetched" state: the block filled from the real
 * endpoint and marked fetched, so read-only fields lock as they do in
 * production. A failed request puts its error on the label instead.
 */
export function fetchedSpecimenBlocks(
  def: CustomBlockWorkingFile,
  fetched: FetchedSpecimen,
): Block[] {
  const id = "specimen-fetched";
  if (!fetched.ok) {
    return [
      createParagraphBlock({
        id: `${id}-label`,
        content: `<p><strong>Specimen:</strong> fetched. The request failed: ${escapeHtml(fetched.error)}</p>`,
      }),
    ];
  }
  return [
    createParagraphBlock({
      id: `${id}-label`,
      content: "<p><strong>Specimen:</strong> fetched</p>",
    }),
    {
      ...createCustomBlock(def as CustomBlockDefinition),
      id,
      fieldValues: fetched.fieldValues,
      dataSourceFetched: true,
    },
  ];
}

/** The id each state's custom block gets in the specimen sheet; its label is `${id}-label`. */
export function specimenBlockId(state: SpecimenState): string {
  return `specimen-${state}`;
}

export function buildSpecimenTemplate(
  def: CustomBlockWorkingFile,
  host?: TemplateContent,
  only?: SpecimenState,
): TemplateContent {
  const content = host ? structuredClone(host) : createDefaultTemplateContent();
  for (const instance of buildSpecimen(def)) {
    if (only && instance.state !== only) continue;
    // Fixed ids, not fresh ones: the sheet is rebuilt on every reload and
    // page load, and a note left on a block keys on its id. A random id
    // would orphan every note at the next reload.
    const id = specimenBlockId(instance.state);
    content.blocks.push(
      createParagraphBlock({
        id: `${id}-label`,
        content: `<p><strong>Specimen:</strong> ${instance.state}</p>`,
      }),
      {
        ...createCustomBlock(def as CustomBlockDefinition),
        id,
        fieldValues: instance.fieldValues,
      },
    );
  }
  return content;
}
