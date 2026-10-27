import {
  SETTINGS_TRANSLATABLE_FIELDS,
  safeClone,
  deepEqual,
  type TemplateSettings,
  type SettingsLocaleLayer,
  isStructuralLocalePath,
  isTranslatablePath,
  isSafePath,
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
const SKIP = new Set([
  "id",
  "type",
  "children",
  "columns",
  "l10n",
  "renderedHtml",
]);

/** Restore requested fields in a projection, preserving sibling overrides. */
export function resetLocalizedFields(
  base: Block,
  view: Block,
  paths: readonly string[],
): ReadonlySet<string> {
  const restoredAncestors = new Set<string>();
  for (const path of paths) {
    if (!isSafePath(path)) continue;
    const segments = path.split(".");
    const key = segments.pop()!;
    const parentPath = segments.join(".");
    const value = readPath(base, path);
    let parent: unknown = view;
    for (const [index, segment] of segments.entries()) {
      const ancestorPath = segments.slice(0, index + 1).join(".");
      if (
        value !== undefined &&
        isRecord(parent) &&
        readPath(parent, segment) === undefined &&
        isRecord(readPath(base, ancestorPath))
      ) {
        parent[segment] = {};
        restoredAncestors.add(ancestorPath);
      }
      parent = readPath(parent, segment);
    }
    if (Array.isArray(parent)) {
      const index = parent.findIndex(
        (item) => isRecord(item) && item.id === key,
      );
      if (index < 0) continue;
      if (value === undefined) parent.splice(index, 1);
      else parent[index] = safeClone(value);
    } else if (isRecord(parent)) {
      if (value === undefined) delete parent[key];
      else parent[key] = safeClone(value);
      if (
        parentPath &&
        Object.keys(parent).length === 0 &&
        readPath(base, parentPath) === undefined
      ) {
        resetLocalizedFields(base, view, [parentPath]);
      }
    }
  }
  return restoredAncestors;
}

/** Leaf paths that differ, walking records and lists addressed by element id. */
function changedLeaves(
  base: unknown,
  next: unknown,
  prefix: string,
  out: Map<string, unknown>,
  walkIds = true,
  restoredAncestors: ReadonlySet<string> = new Set(),
): void {
  if (isRecord(base) && isRecord(next) && !restoredAncestors.has(prefix)) {
    for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
      if (!prefix && SKIP.has(key)) continue;
      changedLeaves(
        base[key],
        next[key],
        prefix ? `${prefix}.${key}` : key,
        out,
        walkIds,
        restoredAncestors,
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
          restoredAncestors,
        );
    }
    return;
  }
  if (!deepEqual(base, next)) out.set(prefix, next);
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
  restoredAncestors: ReadonlySet<string> = new Set(),
): BlockLocaleLayer {
  const leaves = new Map<string, unknown>();
  // Keep recreated ancestors whole so their absent siblings stay deleted.
  changedLeaves(
    base,
    view,
    "",
    leaves,
    base.type !== "custom",
    restoredAncestors,
  );
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

/** Merge net changed leaves, updating covering overrides without losing siblings. */
export function changedLayer(
  previous: BlockLocaleLayer | undefined,
  before: BlockLocaleLayer,
  after: BlockLocaleLayer,
  base: unknown,
  view: unknown,
  resetPaths: readonly string[] = [],
): BlockLocaleLayer {
  const layer = safeClone(previous ?? {});
  const paths = [
    ...new Set([
      ...resetPaths,
      ...[
        ...new Set([
          ...Object.keys(before.text ?? {}),
          ...Object.keys(before.set ?? {}),
          ...Object.keys(after.text ?? {}),
          ...Object.keys(after.set ?? {}),
        ]),
      ].filter(
        (path) =>
          !deepEqual(before.text?.[path], after.text?.[path]) ||
          !deepEqual(before.set?.[path], after.set?.[path]),
      ),
    ]),
  ];
  const covering = Object.keys(previous?.set ?? {}).filter((ancestor) =>
    paths.some((path) => path.startsWith(`${ancestor}.`)),
  );
  for (const ancestor of covering) {
    const value = readPath(view, ancestor);
    const resets = paths.filter(
      (path) =>
        path.startsWith(`${ancestor}.`) &&
        deepEqual(readPath(base, path), readPath(view, path)),
    );
    if (deepEqual(value, readPath(base, ancestor))) delete layer.set![ancestor];
    else if (
      resets.length &&
      isRecord(readPath(base, ancestor)) &&
      isRecord(value)
    ) {
      // A copied default inside a whole-object override would stop inheriting.
      // Split the covering object, keeping every untouched sibling explicit.
      delete layer.set![ancestor];
      const split = (
        path: string,
        previousValue: unknown,
        nextValue: unknown,
      ): void => {
        if (
          resets.some((reset) => path === reset || path.startsWith(`${reset}.`))
        )
          return;
        if (isRecord(previousValue) && isRecord(nextValue)) {
          for (const key of new Set([
            ...Object.keys(previousValue),
            ...Object.keys(nextValue),
          ]))
            split(`${path}.${key}`, previousValue[key], nextValue[key]);
          return;
        }
        if (
          isRecord(base) &&
          base.type !== "custom" &&
          isIdList(previousValue) &&
          isIdList(nextValue)
        ) {
          for (const item of nextValue)
            split(
              `${path}.${item.id}`,
              previousValue.find((old) => old.id === item.id),
              item,
            );
          return;
        }
        if (
          isRecord(base) &&
          typeof base.type === "string" &&
          isStructuralLocalePath(base as unknown as Block, path, nextValue)
        )
          return;
        // Existing text entries keep their extraction hash and representation.
        if (layer.text?.[path] && layer.text[path].value === nextValue) return;
        (layer.set ??= {})[path] =
          nextValue === undefined ? null : safeClone(nextValue);
      };
      split(ancestor, readPath(base, ancestor), value);
    } else layer.set![ancestor] = value === undefined ? null : safeClone(value);
    for (const kind of ["text", "set"] as const)
      for (const stored of Object.keys(layer[kind] ?? {})) {
        if (!stored.startsWith(`${ancestor}.`)) continue;
        const storedValue =
          kind === "text"
            ? layer.text![stored].value
            : (layer.set![stored] ?? undefined);
        if (!deepEqual(storedValue, readPath(view, stored)))
          delete layer[kind]![stored];
      }
  }
  for (const path of paths) {
    if (covering.includes(path)) continue;
    for (const kind of ["text", "set"] as const)
      for (const stored of Object.keys(layer[kind] ?? {}))
        if (stored === path || stored.startsWith(`${path}.`))
          delete layer[kind]![stored];
    if (after.text && Object.hasOwn(after.text, path))
      (layer.text ??= {})[path] = after.text[path];
    if (
      after.set &&
      Object.hasOwn(after.set, path) &&
      !covering.some(
        (ancestor) =>
          Object.hasOwn(layer.set ?? {}, ancestor) &&
          path.startsWith(`${ancestor}.`),
      )
    )
      (layer.set ??= {})[path] = after.set[path];
  }
  if (layer.text && !Object.keys(layer.text).length) delete layer.text;
  if (layer.set && !Object.keys(layer.set).length) delete layer.set;
  return layer;
}
