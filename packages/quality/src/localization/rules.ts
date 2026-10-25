import {
  decodeHtmlEntities,
  localeCoverage,
  readPath,
  replaceMergeTagSpans,
  resolveSyntax,
  SETTINGS_TRANSLATABLE_FIELDS,
  translatableFields,
  type Block,
  type SyntaxPreset,
  type TemplateContent,
  type TemplateSettings,
} from "@templatical/types";
import type { ResolvedOptions, Rule, RuleHit } from "../types";
import { walkBlocks } from "../walk";

interface TextField {
  blockId: string | null;
  field: string;
  target: Block | TemplateSettings;
}

function textFields(
  content: TemplateContent,
  opts: ResolvedOptions,
): Map<string, TextField> {
  const fields = new Map<string, TextField>();
  walkBlocks(content, (block) => {
    for (const field of translatableFields(block, opts.customBlocks)) {
      fields.set(`${block.id}/${field}`, {
        blockId: block.id,
        field,
        target: block,
      });
    }
  });
  for (const field of SETTINGS_TRANSLATABLE_FIELDS) {
    fields.set(`settings/${field}`, {
      blockId: null,
      field,
      target: content.settings,
    });
  }
  return fields;
}

function fieldHit({ blockId, field }: TextField): RuleHit {
  return {
    blockId,
    params: { field },
  };
}

function coverage(content: TemplateContent, opts: ResolvedOptions) {
  return localeCoverage(content, opts.contentLocale!, opts.customBlocks);
}

/**
 * Span tokens stay opaque. Raw syntax matches include remaining attributes
 * and decode once; copying regexes preserves the consumer's regex state.
 */
function tokens(value: string, syntax: SyntaxPreset): string[] {
  const spanTokens: string[] = [];
  let marker = "\u0000MT";
  while (value.includes(marker)) marker += "_";
  const remaining = replaceMergeTagSpans(value, (token) => {
    const index = spanTokens.push(token) - 1;
    return `${marker}${index}\u0000`;
  });
  const placeholders = Array.from(
    remaining.matchAll(new RegExp(`${marker}\\d+\u0000`, "g")),
    (match) => ({ start: match.index, end: match.index + match[0].length }),
  );
  const matches: { start: number; end: number; value: string }[] = [];
  for (const regex of [syntax.logic, syntax.value]) {
    const pattern = new RegExp(
      regex.source,
      regex.flags.replace(/[gy]/g, "") + "g",
    );
    for (const match of remaining.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        placeholders.some(
          (placeholder) => start < placeholder.end && end > placeholder.start,
        )
      )
        continue;
      if (matches.some((other) => start < other.end && end > other.start))
        continue;
      matches.push({ start, end, value: decodeHtmlEntities(match[0]) });
    }
  }
  return [...spanTokens, ...matches.map((match) => match.value)].sort();
}

const untranslated: Rule = {
  meta: {
    id: "localization.untranslated",
    severity: "warning",
    reference:
      "https://docs.templatical.com/guide/localized-templates#missing-values",
  },
  template: (content, opts) => {
    const fields = textFields(content, opts);
    return coverage(content, opts).missing.map((id) =>
      fieldHit(fields.get(id)!),
    );
  },
};

const stale: Rule = {
  meta: {
    id: "localization.stale",
    severity: "warning",
    reference:
      "https://docs.templatical.com/guide/localized-templates#out-of-date-values",
  },
  template: (content, opts) => {
    const fields = textFields(content, opts);
    return coverage(content, opts).stale.map((id) => fieldHit(fields.get(id)!));
  },
};

const mergeTagsDiffer: Rule = {
  meta: {
    id: "localization.merge-tags-differ",
    severity: "warning",
    reference:
      "https://docs.templatical.com/guide/localized-templates#merge-tags",
  },
  template: (content, opts) => {
    const fields = textFields(content, opts);
    const covered = coverage(content, opts);
    const syntax = resolveSyntax(opts.mergeTagSyntax);
    return [...covered.translated, ...covered.stale].flatMap((id) => {
      const entry = fields.get(id)!;
      const { target, field } = entry;
      const base = readPath(target, field);
      const translated =
        target?.l10n?.[opts.contentLocale!]?.text?.[field]?.value;
      if (typeof base !== "string" || translated === undefined) return [];
      return JSON.stringify(tokens(base, syntax)) ===
        JSON.stringify(tokens(translated, syntax))
        ? []
        : [fieldHit(entry)];
    });
  },
};

export const LOCALIZATION_RULES: Rule[] = [
  untranslated,
  stale,
  mergeTagsDiffer,
];
