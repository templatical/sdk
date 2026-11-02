import type { Block } from "./blocks";
import type { CustomBlockDefinition } from "./custom-blocks";
import { decodeHtmlEntities, findOpenTagEnd } from "./html-scan";
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
type Range = {
  start: number;
  end: number;
  markup: string;
  attribute: boolean;
  term?: string;
};

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

/** Map decoded boundaries to source offsets, excluding reference interiors. */
function decodedTermText(text: string): { text: string; offsets?: number[] } {
  if (!text.includes("&")) return { text };
  let decoded = "";
  const offsets = [0];
  let cursor = 0;
  const literal = (end: number) => {
    decoded += text.slice(cursor, end);
    while (cursor < end) offsets.push(++cursor);
  };
  for (const match of text.matchAll(
    /&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
  )) {
    literal(match.index);
    const value = decodeHtmlEntities(match[0]);
    decoded += value;
    for (let i = 1; i < value.length; i++) offsets.push(-1);
    cursor = match.index + match[0].length;
    offsets.push(cursor);
  }
  literal(text.length);
  return { text: decoded, offsets };
}

/** Compiled term patterns, one per term list; `null` when no term is left after trimming. */
const termPatterns = new WeakMap<readonly string[], RegExp | null>();

function termPattern(terms: readonly string[]): RegExp | null {
  let pattern = termPatterns.get(terms);
  if (pattern === undefined) {
    const alternatives = terms
      .map((term) => term.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    pattern = alternatives.length
      ? new RegExp(
          `(?<![\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}_])`,
          "gu",
        )
      : null;
    termPatterns.set(terms, pattern);
  }
  return pattern;
}

function termRanges(
  text: string,
  format: Format,
  terms: readonly string[],
): Range[] {
  const pattern = terms.length ? termPattern(terms) : null;
  if (!pattern) return [];
  const segments: { start: number; end: number; attribute: boolean }[] = [];
  if (format === "text")
    segments.push({ start: 0, end: text.length, attribute: false });
  else {
    segments.push(
      ...attributeRanges(text).map((range) => ({ ...range, attribute: true })),
    );
    const markup = /<(?:\/?[a-z][\w:-]*\b|!--|!|\?)/gi;
    let cursor = 0;
    for (let match; (match = markup.exec(text));) {
      segments.push({ start: cursor, end: match.index, attribute: false });
      const end =
        match[0] === "<!--"
          ? text.indexOf("-->", markup.lastIndex)
          : findOpenTagEnd(text, markup.lastIndex);
      if (end < 0) return [];
      cursor = end + (match[0] === "<!--" ? 3 : 1);
      markup.lastIndex = cursor;
    }
    segments.push({ start: cursor, end: text.length, attribute: false });
  }
  const ranges: Range[] = [];
  for (const segment of segments) {
    pattern.lastIndex = 0;
    const value = text.slice(segment.start, segment.end);
    const decoded =
      format === "html"
        ? decodedTermText(value)
        : { text: value, offsets: undefined };
    for (let match; (match = pattern.exec(decoded.text));) {
      const from = decoded.offsets?.[match.index] ?? match.index;
      const to =
        decoded.offsets?.[match.index + match[0].length] ??
        match.index + match[0].length;
      if (from < 0 || to < 0) continue;
      const start = segment.start + from;
      const end = segment.start + to;
      ranges.push({
        start,
        end,
        markup: text.slice(start, end),
        attribute: segment.attribute,
        term: match[0],
      });
    }
  }
  return ranges;
}

function maskingRanges(
  text: string,
  syntax: SyntaxPreset,
  format: Format,
  options?: { doNotTranslate?: readonly string[] },
): Range[] {
  const tags = tagRanges(text, syntax, format);
  const terms = termRanges(text, format, options?.doNotTranslate ?? []).filter(
    (term) => !tags.some((tag) => term.start < tag.end && term.end > tag.start),
  );
  return [...tags, ...terms].sort((a, b) => a.start - b.start);
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

/** Mask chips whole in HTML, raw tags and configured terms in both formats. */
export function maskTags(
  text: string,
  syntax: SyntaxPreset,
  format: Format,
  options?: { doNotTranslate?: readonly string[] },
): { text: string; tokens: string[] } {
  const ranges = maskingRanges(text, syntax, format, options);
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
  options?: { doNotTranslate?: readonly string[] },
): string | null {
  const ranges = maskingRanges(text, syntax, format, options);
  const used = new Set<number>();
  const claim = (matches: (token: string) => boolean) => {
    const index = tokens.findIndex(
      (token, i) => !used.has(i) && matches(token),
    );
    if (index >= 0) used.add(index);
    return index;
  };
  // Exact spellings first, so another spelling of a term keeps its own bytes.
  const indexes = ranges.map((range) =>
    claim((token) => token === range.markup),
  );
  ranges.forEach((range, i) => {
    if (indexes[i] < 0 && range.term !== undefined && format === "html")
      indexes[i] = claim((token) => decodeHtmlEntities(token) === range.term);
  });
  // A term beyond the protected occurrences is plain text; a tag isn't.
  if (
    used.size !== tokens.length ||
    ranges.some((range, i) => indexes[i] < 0 && range.term === undefined)
  )
    return null;
  const matched = ranges.filter((_, i) => indexes[i] >= 0);
  return maskedText(
    text,
    matched,
    indexes.filter((index) => index >= 0).map((index) => index + 1),
  );
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
      else if (block.type === "wrapper") walk(block.children);
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
    doNotTranslate?: readonly string[];
  },
): { strings: LocaleString[]; tokens: Record<string, string[]> } {
  // Coverage lists every eligible field (its default isn't empty), so only
  // gaps need it to select.
  const coverage =
    options.only === "all"
      ? null
      : localeCoverage(content, locale, options.definitions);
  const selected =
    coverage && new Set([...coverage.missing, ...coverage.stale]);
  const strings: LocaleString[] = [];
  const tokens: Record<string, string[]> = {};
  for (const [id, field] of eligibleFields(
    content,
    locale,
    options.definitions,
  )) {
    if (
      (selected && !selected.has(id)) ||
      (options.blockId !== undefined &&
        (field.target.kind !== "block" ||
          field.target.blockId !== options.blockId))
    )
      continue;
    const masked = maskTags(
      field.source,
      options.syntax,
      field.format,
      options,
    );
    const text = field.text
      ? maskTranslation(
          field.text.value,
          masked.tokens,
          options.syntax,
          field.format,
          options,
        )
      : undefined;
    strings.push({
      id,
      format: field.format,
      source: masked.text,
      sourceHash: sourceHash(field.source),
      ...(text === undefined || text === null ? {} : { text }),
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
    doNotTranslate?: readonly string[];
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
      else if (block.type === "wrapper") walk(block.children);
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
      maskTranslation(text, tokens, options.syntax, field.format, options) ===
        null
    ) {
      rejected.push({ id: value.id, reason: "tags_changed" });
      continue;
    }
    const texts =
      field.target.kind === "settings"
        ? (settingsText ??= {})
        : (grouped.get(field.target.blockId) ?? {});
    texts[field.path] = { value: text, sourceHash: value.sourceHash };
    if (field.target.kind === "block") grouped.set(field.target.blockId, texts);
  }
  const operations: Operation[] = [];
  for (const [blockId, text] of grouped)
    operations.push({ op: "updateBlockLocale", blockId, locale, text });
  if (settingsText)
    operations.push({ op: "updateSettingsLocale", locale, text: settingsText });
  return { operations, rejected };
}
