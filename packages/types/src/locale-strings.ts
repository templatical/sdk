import type { Block } from "./blocks";
import type { CustomBlockDefinition } from "./custom-blocks";
import { findOpenTagEnd } from "./html-scan";
import {
  defaultLocaleOf,
  localeCoverage,
  readPath,
  SETTINGS_TRANSLATABLE_FIELDS,
  sourceHash,
  translatableFields,
  type LocalizedText,
} from "./localization";
import { scanMergeTagSpans } from "./merge-tag-html";
import type { SyntaxPreset } from "./merge-tags";
import type { Operation } from "./operations";
import type { TemplateContent } from "./template";

/** Only these translatable fields contain rich-text HTML. */
export const TRANSLATABLE_HTML_FIELDS: Readonly<
  Record<string, readonly string[]>
> = {
  title: ["content"],
  paragraph: ["content"],
};

type Format = "html" | "text";
type Range = { start: number; end: number; markup: string; attribute: boolean };

function attributeRanges(html: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const tags = /<[a-z][\w:-]*\b/gi;
  while (tags.exec(html)) {
    const end = findOpenTagEnd(html, tags.lastIndex);
    if (end < 0) break;
    const from = tags.lastIndex;
    const attrs = html.slice(from, end);
    const pattern =
      /[^\s"'<>/=]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    for (let attr; (attr = pattern.exec(attrs));) {
      const value = attr[1] ?? attr[2] ?? attr[3];
      const valueEnd =
        from + pattern.lastIndex - (attr[3] === undefined ? 1 : 0);
      ranges.push({ start: valueEnd - value.length, end: valueEnd });
    }
    tags.lastIndex = end + 1;
  }
  return ranges;
}

function tagRanges(
  text: string,
  syntax: SyntaxPreset,
  format: Format,
): Range[] {
  const chips = format === "html" ? scanMergeTagSpans(text) : [];
  const attributes = format === "html" ? attributeRanges(text) : [];
  const ranges: Range[] = chips.map((chip) => ({ ...chip, attribute: false }));
  const raw = (start: number, end: number) => {
    const segment = text.slice(start, end);
    const patterns = [syntax.logic, syntax.value].map(
      (pattern) =>
        new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "") + "g"),
    );
    let cursor = 0;
    while (cursor < segment.length) {
      const matches = patterns.flatMap((pattern) => {
        pattern.lastIndex = cursor;
        let match = pattern.exec(segment);
        while (match && match[0].length === 0) {
          pattern.lastIndex = match.index + 1;
          match = pattern.exec(segment);
        }
        return match ? [match] : [];
      });
      matches.sort((a, b) => a.index - b.index || a[0].length - b[0].length);
      const match = matches[0];
      if (!match) break;
      const from = start + match.index;
      const to = from + match[0].length;
      ranges.push({
        start: from,
        end: to,
        markup: match[0],
        attribute: attributes.some(
          (attr) => from >= attr.start && to <= attr.end,
        ),
      });
      cursor = match.index + match[0].length;
    }
  };
  let cursor = 0;
  for (const chip of chips) {
    raw(cursor, chip.start);
    cursor = chip.end;
  }
  raw(cursor, text.length);
  return ranges.sort((a, b) => a.start - b.start);
}

function maskedText(text: string, ranges: Range[], ids: number[]): string {
  let out = "";
  let cursor = 0;
  ranges.forEach((range, i) => {
    out += text.slice(cursor, range.start);
    out += range.attribute ? `__x${ids[i]}__` : `<x id="${ids[i]}"/>`;
    cursor = range.end;
  });
  return out + text.slice(cursor);
}

/** Mask chips whole in HTML, and raw merge and logic tags in both formats. */
export function maskTags(
  text: string,
  syntax: SyntaxPreset,
  format: Format,
): { text: string; tokens: string[] } {
  const ranges = tagRanges(text, syntax, format);
  return {
    text: maskedText(
      text,
      ranges,
      ranges.map((_, i) => i + 1),
    ),
    tokens: ranges.map((range) => range.markup),
  };
}

/** Restore original bytes only when every source placeholder occurs exactly once. */
export function unmaskTags(text: string, tokens: string[]): string | null {
  const seen = new Set<number>();
  let valid = true;
  const result = text.replace(
    /<x id="(\d+)"\s*\/>|<x id="(\d+)"><\/x>|__x(\d+)__/g,
    (_match, self: string, paired: string, attribute: string) => {
      const id = Number(self ?? paired ?? attribute);
      if (id < 1 || id > tokens.length || seen.has(id)) valid = false;
      seen.add(id);
      return tokens[id - 1] ?? "";
    },
  );
  return valid && seen.size === tokens.length ? result : null;
}

function maskTranslation(
  text: string,
  tokens: string[],
  syntax: SyntaxPreset,
  format: Format,
): string | null {
  const ranges = tagRanges(text, syntax, format);
  const used = new Set<number>();
  const ids: number[] = [];
  for (const range of ranges) {
    const index = tokens.findIndex(
      (token, i) => token === range.markup && !used.has(i),
    );
    if (index < 0) return null;
    used.add(index);
    ids.push(index + 1);
  }
  return used.size === tokens.length ? maskedText(text, ranges, ids) : null;
}

export interface LocaleString {
  id: string;
  format: "html" | "text";
  /** The masked default value. */
  source: string;
  /** The hash of the unmasked default at extraction time. */
  sourceHash: string;
  /** The stored translation masked with the source's token ids. */
  text?: string;
}

type Field = {
  target: { kind: "block"; blockId: string } | { kind: "settings" };
  path: string;
  source: string;
  format: Format;
  text?: LocalizedText;
};

function eligibleFields(
  content: TemplateContent,
  locale: string,
  definitions: readonly CustomBlockDefinition[] = [],
): Map<string, Field> {
  const fields = new Map<string, Field>();
  if (
    locale === defaultLocaleOf(content) ||
    !content.settings.locales?.includes(locale)
  )
    return fields;
  const visit = (
    fieldTarget: Field["target"],
    target: Block | TemplateContent["settings"],
    paths: readonly string[],
    type?: string,
  ) => {
    const layer = target.l10n?.[locale];
    for (const path of paths) {
      const source = readPath(target, path);
      if (
        typeof source !== "string" ||
        source === "" ||
        Object.keys(layer?.set ?? {}).some(
          (key) => key === path || path.startsWith(`${key}.`),
        )
      )
        continue;
      const prefix =
        fieldTarget.kind === "block" ? fieldTarget.blockId : "settings";
      fields.set(`${prefix}/${path}`, {
        target: fieldTarget,
        path,
        source,
        format:
          type && TRANSLATABLE_HTML_FIELDS[type]?.includes(path)
            ? "html"
            : "text",
        text: layer?.text?.[path],
      });
    }
  };
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.l10n?.[locale]?.hidden) continue;
      if (block.type !== "html")
        visit(
          { kind: "block", blockId: block.id },
          block,
          translatableFields(block, definitions),
          block.type,
        );
      if (block.type === "section")
        for (const column of block.children) walk(column);
    }
  };
  walk(content.blocks);
  visit({ kind: "settings" }, content.settings, SETTINGS_TRANSLATABLE_FIELDS);
  return fields;
}

/** Extract eligible fields in document order, with settings last. */
export function localeStrings(
  content: TemplateContent,
  locale: string,
  options: {
    definitions?: readonly CustomBlockDefinition[];
    syntax: SyntaxPreset;
    only: "gaps" | "all";
    blockId?: string;
  },
): { strings: LocaleString[]; tokens: Record<string, string[]> } {
  const coverage = localeCoverage(content, locale, options.definitions);
  const selected = new Set(
    options.only === "all"
      ? [...coverage.translated, ...coverage.missing, ...coverage.stale]
      : [...coverage.missing, ...coverage.stale],
  );
  const strings: LocaleString[] = [];
  const tokens: Record<string, string[]> = {};
  for (const [id, field] of eligibleFields(
    content,
    locale,
    options.definitions,
  )) {
    if (
      !selected.has(id) ||
      (options.blockId !== undefined &&
        (field.target.kind !== "block" ||
          field.target.blockId !== options.blockId))
    )
      continue;
    const masked = maskTags(field.source, options.syntax, field.format);
    const text = field.text
      ? maskTranslation(
          field.text.value,
          masked.tokens,
          options.syntax,
          field.format,
        )
      : undefined;
    if (text === null) continue;
    strings.push({
      id,
      format: field.format,
      source: masked.text,
      sourceHash: sourceHash(field.source),
      ...(text === undefined ? {} : { text }),
    });
    tokens[id] = masked.tokens;
  }
  return { strings, tokens };
}

/** Build locale operations without mutating content; preserve each extraction hash. */
export function applyLocaleStrings(
  content: TemplateContent,
  locale: string,
  values: { id: string; text: string; sourceHash: string }[],
  options: {
    definitions?: readonly CustomBlockDefinition[];
    syntax: SyntaxPreset;
    tokens: Record<string, string[]>;
  },
): {
  operations: Operation[];
  rejected: {
    id: string;
    reason: "tags_changed" | "unknown_field" | "not_translatable";
  }[];
} {
  const fields = eligibleFields(content, locale, options.definitions);
  const blocks = new Map<string, Block>();
  const walk = (items: Block[]) => {
    for (const block of items) {
      blocks.set(block.id, block);
      if (block.type === "section")
        for (const column of block.children) walk(column);
    }
  };
  walk(content.blocks);
  const grouped = new Map<string, Record<string, LocalizedText>>();
  let settingsText: Record<string, LocalizedText> | undefined;
  const rejected: {
    id: string;
    reason: "tags_changed" | "unknown_field" | "not_translatable";
  }[] = [];
  for (const value of values) {
    const field = fields.get(value.id);
    if (!field) {
      const separator = value.id.lastIndexOf("/");
      const blockId = value.id.slice(0, separator);
      const targets =
        blockId === "settings"
          ? [blocks.get(blockId), content.settings]
          : [blocks.get(blockId)];
      rejected.push({
        id: value.id,
        reason:
          separator < 0 ||
          !targets.some(
            (target) =>
              target &&
              readPath(target, value.id.slice(separator + 1)) !== undefined,
          )
            ? "unknown_field"
            : "not_translatable",
      });
      continue;
    }
    const tokens = Object.hasOwn(options.tokens, value.id)
      ? options.tokens[value.id]
      : undefined;
    const text = tokens ? unmaskTags(value.text, tokens) : null;
    if (
      !tokens ||
      text === null ||
      maskTranslation(text, tokens, options.syntax, field.format) === null
    ) {
      rejected.push({ id: value.id, reason: "tags_changed" });
      continue;
    }
    const texts =
      field.target.kind === "settings"
        ? (settingsText ??= {})
        : (grouped.get(field.target.blockId) ?? {});
    texts[field.path] = { value: text, source: value.sourceHash };
    if (field.target.kind === "block") grouped.set(field.target.blockId, texts);
  }
  const operations: Operation[] = [];
  for (const [blockId, text] of grouped)
    operations.push({ op: "updateBlockLocale", blockId, locale, text });
  if (settingsText)
    operations.push({ op: "updateSettingsLocale", locale, text: settingsText });
  return { operations, rejected };
}
