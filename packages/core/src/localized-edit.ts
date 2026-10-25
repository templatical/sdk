import {
  SETTINGS_TRANSLATABLE_FIELDS,
  safeClone,
  type TemplateSettings,
  type SettingsLocaleLayer,
  isTranslatablePath,
  readPath,
  sourceHash,
  translatableFields,
  type Block,
  type BlockLocaleLayer,
  type CustomBlockDefinition,
  type LocalizedText,
} from "@templatical/types";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isIdList = (value: unknown): value is Json[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => isRecord(item) && typeof item.id === "string");
const SKIP = new Set(["id", "type", "children", "columns", "l10n"]);

/** Leaf paths that differ, walking records and lists addressed by element id. */
function changedLeaves(
  base: unknown,
  next: unknown,
  prefix: string,
  out: Map<string, unknown>,
  walkIds = true,
): void {
  if (isRecord(base) && isRecord(next)) {
    for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
      if (!prefix && SKIP.has(key)) continue;
      changedLeaves(
        base[key],
        next[key],
        prefix ? `${prefix}.${key}` : key,
        out,
        walkIds,
      );
    }
    return;
  }
  if (walkIds && isIdList(base) && isIdList(next)) {
    for (const item of next) {
      if ((item.id as string).includes(".")) continue;
      const match = base.find((candidate) => candidate.id === item.id);
      if (match)
        changedLeaves(
          match,
          item,
          `${prefix}.${item.id as string}`,
          out,
          walkIds,
        );
    }
    return;
  }
  if (JSON.stringify(base) !== JSON.stringify(next)) out.set(prefix, next);
}

/**
 * Derive text and property overrides from a localized view. Unchanged values
 * keep their previous source hash; values equal to the base reset. Clearing a
 * property uses null, the layer's deletion marker. Hidden carries over.
 */
export function deriveLayer(
  base: Block,
  view: Block,
  previous: BlockLocaleLayer | undefined,
  definitions: readonly CustomBlockDefinition[] = [],
): BlockLocaleLayer {
  const leaves = new Map<string, unknown>();
  changedLeaves(base, view, "", leaves, base.type !== "custom");
  const customText = new Set(
    base.type === "custom" ? translatableFields(base, definitions) : [],
  );
  const text: Record<string, LocalizedText> = {};
  const set: Record<string, unknown> = {};
  for (const [path, value] of leaves) {
    const translatable =
      base.type === "custom"
        ? customText.has(path)
        : isTranslatablePath(base.type, path);
    if (
      translatable &&
      typeof value === "string" &&
      readPath(base, path) !== undefined
    ) {
      const before = previous?.text?.[path];
      text[path] =
        before && before.value === value
          ? before
          : { value, source: sourceHash(String(readPath(base, path) ?? "")) };
    } else {
      set[path] = value === undefined ? null : value;
    }
  }
  const layer: BlockLocaleLayer = {};
  if (Object.keys(text).length) layer.text = text;
  if (Object.keys(set).length) layer.set = set;
  if (previous?.hidden) layer.hidden = true;
  return layer;
}

/** Shared list/section structure changes preserve existing elements' base data. */
export function reconcileStructure(
  base: Block,
  next: Block,
  findBlock: (id: string) => Block | null,
): boolean {
  let changed = false;
  function reconcileList(
    target: Json,
    view: Json,
    key: string,
    childKey?: string,
  ): void {
    const before = target[key];
    const value = view[key];
    const validList = (list: unknown): list is Json[] =>
      Array.isArray(list) &&
      list.every((item) => isRecord(item) && typeof item.id === "string");
    if (!validList(before) || !validList(value)) return;
    if (
      JSON.stringify(before.map((item) => item.id)) !==
      JSON.stringify(value.map((item) => item.id))
    ) {
      changed = true;
      target[key] = value.map((item) =>
        safeClone(before.find((old) => old.id === item.id) ?? item),
      );
    }
    if (childKey)
      for (const item of value) {
        const existing = (target[key] as Json[]).find(
          (old) => old.id === item.id,
        );
        if (existing) reconcileList(existing, item, childKey);
      }
  }
  const target = base as unknown as Json;
  const view = next as unknown as Json;
  if (base.type === "menu") reconcileList(target, view, "items");
  if (base.type === "table") reconcileList(target, view, "rows", "cells");
  if (base.type === "social") reconcileList(target, view, "icons");
  if (base.type === "section" && next.type === "section") {
    const ids = (columns: Block[][]) =>
      columns.map((column) => column.map((block) => block.id));
    if (
      base.columns !== next.columns ||
      JSON.stringify(ids(base.children)) !== JSON.stringify(ids(next.children))
    ) {
      changed = true;
      base.columns = next.columns;
      base.children = next.children.map((column) =>
        column.map((block) => safeClone(findBlock(block.id) ?? block)),
      );
    }
  }
  return changed;
}

/** Settings follow the same leaf rules, with preheaderText as their text field. */
export function deriveSettingsLayer(
  base: TemplateSettings,
  view: TemplateSettings,
  previous: SettingsLocaleLayer | undefined,
): SettingsLocaleLayer {
  const strip = (settings: TemplateSettings) => {
    const {
      locale: _locale,
      locales: _locales,
      l10n: _l10n,
      ...rest
    } = settings;
    return rest;
  };
  const leaves = new Map<string, unknown>();
  changedLeaves(strip(base), strip(view), "", leaves);
  const layer: SettingsLocaleLayer = {};
  for (const [path, value] of leaves) {
    if (
      SETTINGS_TRANSLATABLE_FIELDS.includes(path) &&
      typeof value === "string" &&
      readPath(base, path) !== undefined
    ) {
      const before = previous?.text?.[path];
      (layer.text ??= {})[path] =
        before?.value === value
          ? before
          : { value, source: sourceHash(String(readPath(base, path) ?? "")) };
    } else (layer.set ??= {})[path] = value === undefined ? null : value;
  }
  return layer;
}
