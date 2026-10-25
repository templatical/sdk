import type { Block } from "./blocks";
import { safeClone } from "./clone";
import { SdkError } from "./config";
import type { CustomBlockDefinition } from "./custom-blocks";
import type { TemplateContent, TemplateSettings } from "./template";

/** A translated text value and the hash of the default value it was written against. */
export interface LocalizedText {
  value: string;
  /** `sourceHash(defaultValue)` when the value was written or kept. */
  source: string;
}

/** One language's layer on a block. Members are omitted when empty. */
export interface BlockLocaleLayer {
  /** Translated text, by field path. */
  text?: Record<string, LocalizedText>;
  /** Any other property overridden for this language, by field path. */
  set?: Record<string, unknown>;
  /** The block is left out of this language. */
  hidden?: true;
}

/** One language's layer on the template settings. */
export interface SettingsLocaleLayer {
  text?: Record<string, LocalizedText>;
  set?: Record<string, unknown>;
}

/**
 * Each block type's human-readable text, as path patterns. `*` stands for an
 * element id in a list. Custom blocks' text fields come from their definition.
 */
export const TRANSLATABLE_FIELDS: Readonly<Record<string, readonly string[]>> =
  {
    title: ["content"],
    paragraph: ["content"],
    html: ["content"],
    image: ["alt"],
    video: ["alt"],
    button: ["text"],
    menu: ["items.*.text"],
    table: ["rows.*.cells.*.content"],
    countdown: [
      "labelDays",
      "labelHours",
      "labelMinutes",
      "labelSeconds",
      "expiredMessage",
    ],
    custom: ["fieldValues.*"],
  };

/** The settings' human-readable text. */
export const SETTINGS_TRANSLATABLE_FIELDS: readonly string[] = [
  "preheaderText",
];

/** A language tag LOC1 accepts: a 2–3 letter language, then 2–8 character subtags. */
export function isLocaleTag(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value)
  );
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** True when every segment is usable: non-empty and not a prototype key. */
export function isSafePath(path: string): boolean {
  return path
    .split(".")
    .every((segment) => segment !== "" && !FORBIDDEN_SEGMENTS.has(segment));
}

function step(current: unknown, segment: string): unknown {
  if (FORBIDDEN_SEGMENTS.has(segment)) return undefined;
  if (Array.isArray(current)) {
    return current.find((item) => isRecord(item) && item.id === segment);
  }
  return isRecord(current) && Object.hasOwn(current, segment)
    ? current[segment]
    : undefined;
}

/** The value at a field path, or `undefined` when any segment doesn't resolve. */
export function readPath(target: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(step, target);
}

/** Write at a field path; returns false when the path's parent doesn't resolve. */
export function writePath(target: Json, path: string, value: unknown): boolean {
  if (!isSafePath(path)) return false;
  const segments = path.split(".");
  const last = segments.pop()!;
  const parent = segments.reduce<unknown>(step, target);
  if (Array.isArray(parent)) {
    const index = parent.findIndex(
      (item) => isRecord(item) && item.id === last,
    );
    if (index < 0) return false;
    parent[index] = safeClone(value);
    return true;
  }
  if (!isRecord(parent)) return false;
  // `null` in a layer's `set` means the property is absent in this language.
  if (value === null) delete parent[last];
  else parent[last] = safeClone(value);
  return true;
}

/** Expand a pattern against a block: `*` → each element id present. */
function expand(target: unknown, pattern: string): string[] {
  const [head, ...rest] = pattern.split(".");
  if (head === undefined) return [""];
  const out: string[] = [];
  if (head === "*") {
    const list = Array.isArray(target) ? target : [];
    for (const item of list) {
      if (!isRecord(item) || typeof item.id !== "string") continue;
      for (const tail of rest.length ? expand(item, rest.join(".")) : [""]) {
        out.push(tail ? `${item.id}.${tail}` : item.id);
      }
    }
    return out;
  }
  const next = isRecord(target) ? target[head] : undefined;
  if (rest.length === 0) return next === undefined ? [] : [head];
  for (const tail of expand(next, rest.join("."))) out.push(`${head}.${tail}`);
  return out;
}

/**
 * A block's translatable text paths, with element ids filled in. A custom
 * block's `fieldValues.<key>` counts only for its definition's `text` and
 * `textarea` fields, so without `definitions` it has none.
 */
export function translatableFields(
  block: Block,
  definitions: readonly CustomBlockDefinition[] = [],
): string[] {
  if (block.type === "custom") {
    const definition = definitions.find(
      (candidate) => candidate.type === (block as unknown as Json).customType,
    );
    const textKeys = new Set(
      (definition?.fields ?? [])
        .filter((field) => field.type === "text" || field.type === "textarea")
        .map((field) => field.key),
    );
    const values = (block as unknown as Json).fieldValues;
    return isRecord(values)
      ? Object.keys(values)
          .filter((key) => textKeys.has(key))
          .map((key) => `fieldValues.${key}`)
      : [];
  }
  // Dots delimit path segments, so these imported element ids have no LOC1 path.
  const localizableId = (item: { id: string }) => !item.id.includes(".");
  const target =
    block.type === "menu"
      ? { ...block, items: block.items.filter(localizableId) }
      : block.type === "table"
        ? {
            ...block,
            rows: block.rows.filter(localizableId).map((row) => ({
              ...row,
              cells: row.cells.filter(localizableId),
            })),
          }
        : block;
  return (TRANSLATABLE_FIELDS[block.type] ?? []).flatMap((pattern) =>
    expand(target, pattern),
  );
}

/** Is `path` an instance of one of the block type's text patterns? */
export function isTranslatablePath(blockType: string, path: string): boolean {
  return (TRANSLATABLE_FIELDS[blockType] ?? []).some((pattern) => {
    const want = pattern.split(".");
    const have = path.split(".");
    return (
      want.length === have.length &&
      want.every((segment, i) => segment === "*" || segment === have[i])
    );
  });
}

/** FNV-1a 32-bit over the UTF-8 bytes, as 8 lowercase hex digits. */
export function sourceHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function withoutL10n<T extends Json>(value: T): T {
  const { l10n: _l10n, ...rest } = value;
  return rest as T;
}

/**
 * One block in one language, without its `l10n` and without recursing into
 * children: the editor renders each block through this. For the default
 * locale it only strips `l10n`. Paths that no longer resolve are skipped.
 */
export function localizeBlock(
  block: Block,
  locale: string,
  defaultLocale: string,
): Block {
  const json = block as unknown as Json;
  const view = safeClone(withoutL10n(json));
  if (locale === defaultLocale) return view as unknown as Block;
  const layer = (json.l10n as Record<string, BlockLocaleLayer> | undefined)?.[
    locale
  ];
  if (!layer) return view as unknown as Block;
  for (const [path, value] of Object.entries(layer.set ?? {}))
    writePath(view, path, value);
  for (const [path, text] of Object.entries(layer.text ?? {}))
    writePath(view, path, text.value);
  return view as unknown as Block;
}

function isHidden(block: Block, locale: string): boolean {
  return (
    (block as unknown as Json & { l10n?: Record<string, BlockLocaleLayer> })
      .l10n?.[locale]?.hidden === true
  );
}

function stripSettings(settings: TemplateSettings): TemplateSettings {
  const { locales: _locales, l10n: _l10n, ...rest } = settings;
  return rest as TemplateSettings;
}

/** The template's default (source) language. */
export function defaultLocaleOf(content: TemplateContent): string {
  return content.settings?.locale ?? "en";
}

/**
 * One language of a template, as a plain template: hidden blocks dropped,
 * overrides and translations applied, missing values left at the default
 * (LD3), and no localization fields left. Pure: `content` is not changed.
 */
export function resolveLocale(
  content: TemplateContent,
  locale: string,
): TemplateContent {
  const fallback = defaultLocaleOf(content);
  const locales = content.settings?.locales ?? [];
  if (locale !== fallback && !locales.includes(locale)) {
    throw new SdkError(
      `This template has no "${locale}" version.`,
      undefined,
      "unknown_locale",
    );
  }
  const project = (blocks: Block[]): Block[] =>
    blocks.flatMap((block) => {
      if (locale !== fallback && isHidden(block, locale)) return [];
      const view = localizeBlock(block, locale, fallback) as unknown as Json;
      if (view.type === "section" && Array.isArray(view.children)) {
        view.children = (view.children as Block[][]).map((column) =>
          project(column),
        );
      }
      return [view as unknown as Block];
    });
  const settings = safeClone(
    stripSettings(content.settings),
  ) as unknown as Json;
  const layer = content.settings?.l10n?.[locale];
  if (locale !== fallback && layer) {
    for (const [path, value] of Object.entries(layer.set ?? {}))
      writePath(settings, path, value);
    for (const [path, text] of Object.entries(layer.text ?? {}))
      writePath(settings, path, text.value);
  }
  settings.locale = locale;
  return {
    blocks: project(content.blocks),
    settings: settings as unknown as TemplateSettings,
  };
}

export interface LocaleCoverage {
  translated: string[];
  missing: string[];
  stale: string[];
}

/**
 * Which translatable fields of one language are translated, missing or stale,
 * as field ids, in document order with settings last. Hidden blocks and empty
 * defaults don't count.
 */
export function localeCoverage(
  content: TemplateContent,
  locale: string,
  definitions: readonly CustomBlockDefinition[] = [],
): LocaleCoverage {
  const result: LocaleCoverage = { translated: [], missing: [], stale: [] };
  const visit = (
    id: string,
    target: unknown,
    paths: string[],
    texts: Record<string, LocalizedText> | undefined,
  ) => {
    for (const path of paths) {
      const value = readPath(target, path);
      if (typeof value !== "string") continue;
      const text = texts?.[path];
      // An empty default isn't missing, but an existing translation of it can be stale.
      if (!text && value === "") continue;
      if (!text) result.missing.push(`${id}/${path}`);
      else if (text.source !== sourceHash(value))
        result.stale.push(`${id}/${path}`);
      else result.translated.push(`${id}/${path}`);
    }
  };
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (isHidden(block, locale)) continue;
      const layer = (
        block as unknown as { l10n?: Record<string, BlockLocaleLayer> }
      ).l10n?.[locale];
      visit(
        block.id,
        block,
        translatableFields(block, definitions),
        layer?.text,
      );
      const children = (block as unknown as Json).children;
      if (block.type === "section" && Array.isArray(children)) {
        for (const column of children as Block[][]) walk(column);
      }
    }
  };
  walk(content.blocks);
  visit(
    "settings",
    content.settings,
    [...SETTINGS_TRANSLATABLE_FIELDS],
    content.settings?.l10n?.[locale]?.text,
  );
  return result;
}
