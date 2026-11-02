import {
  applyLocaleStrings,
  applyOperations,
  defaultLocaleOf,
  isLocaleTag,
  localeCoverage,
  localeStrings,
  readPath,
  resolveLocale,
  resolveSyntax,
  SYNTAX_PRESETS,
  SETTINGS_TRANSLATABLE_FIELDS,
  sourceHash,
  translatableFields,
  unmaskTags,
  type Block,
  type LocaleString,
  type Operation,
  type SyntaxPresetName,
  type TemplateContent,
} from "@templatical/types";
import { validateTemplate } from "../../validate";
import { flagValue, type ParsedArgs } from "../args";
import { readDefinitions, readDoNotTranslate } from "../definitions";
import { isSafeTranslationHtml, isSafeTranslationText } from "../html-safety";
import {
  EXIT,
  InvalidTemplateError,
  readTemplateFile,
  UsageError,
  writeTemplateFile,
} from "../io";
import { emit, note } from "../output";

/** A strings file entry; `previous` is never read on import. */
type StringsFileEntry = LocaleString & {
  /** A stale entry's stored translation, masked; `text` is left absent. */
  previous?: string;
};

interface StringsFile {
  templatical: "strings/1";
  sourceLocale: string;
  targetLocale: string;
  strings: StringsFileEntry[];
}

function readStringsFile(file: string, cwd: string): StringsFile {
  const data = readTemplateFile(file, cwd);
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  if (
    !isRecord(data) ||
    data.templatical !== "strings/1" ||
    !isLocaleTag(data.sourceLocale) ||
    !isLocaleTag(data.targetLocale) ||
    !Array.isArray(data.strings) ||
    data.strings.some(
      (entry: unknown) =>
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        (entry.format !== "html" && entry.format !== "text") ||
        typeof entry.source !== "string" ||
        typeof entry.sourceHash !== "string" ||
        (entry.text !== undefined && typeof entry.text !== "string"),
    )
  ) {
    throw new UsageError(
      `${file} must be a strings/1 file with sourceLocale, targetLocale and LocaleString entries.`,
    );
  }
  return data as unknown as StringsFile;
}

/** Refuse the default language: strings work on a language version. */
function assertLanguageVersion(
  template: TemplateContent,
  locale: string,
  file: string,
): void {
  if (locale === defaultLocaleOf(template))
    throw new InvalidTemplateError(
      `"${locale}" is the default language of ${file}, not a language version. Use a language from settings.locales.`,
    );
}

function valueFlag(args: ParsedArgs, name: string): string | undefined {
  const value = flagValue(args, name);
  if (
    args.flags[name] !== undefined &&
    (!value?.trim() || value.startsWith("-"))
  ) {
    throw new UsageError(`--${name} needs a value.`);
  }
  return value;
}

export function runStrings(args: ParsedArgs): number {
  const [command, file, stringsFile] = args.positional;
  if (command !== "export" && command !== "import") {
    throw new UsageError("strings needs export or import.");
  }
  if (!file || (command === "import" && !stringsFile)) {
    throw new UsageError(
      `strings ${command} needs ${command === "import" ? "a template file and a strings file" : "a template file"}.`,
    );
  }
  const cwd = flagValue(args, "cwd") ?? process.cwd();
  const definitions = readDefinitions(args, cwd);
  const doNotTranslate = readDoNotTranslate(args, cwd);
  const preset = valueFlag(args, "syntax");
  // Take the name from the preset list itself, so only a built-in preset's
  // patterns ever reach the masking regexes.
  const presetName = (Object.keys(SYNTAX_PRESETS) as SyntaxPresetName[]).find(
    (name) => name === preset,
  );
  if (preset !== undefined && presetName === undefined) {
    throw new UsageError(
      `Unknown --syntax "${preset}". Use ${Object.keys(SYNTAX_PRESETS).join(", ")}.`,
    );
  }
  const syntax = resolveSyntax(presetName);
  const out = valueFlag(args, "out") ?? valueFlag(args, "o");
  const content = readTemplateFile(file, cwd);
  const assertValid = (data: unknown) => {
    const result = validateTemplate(data, definitions);
    if (!result.valid)
      throw new InvalidTemplateError(
        `${file} is not structurally valid.`,
        result.errors,
      );
  };
  assertValid(content);
  const template = content as TemplateContent;

  if (command === "export") {
    const locale = valueFlag(args, "locale");
    if (!locale) throw new UsageError("strings export needs --locale <tag>.");
    const only = valueFlag(args, "only") ?? "gaps";
    if (only !== "gaps" && only !== "all")
      throw new UsageError("--only must be gaps or all.");
    const blockId = valueFlag(args, "block");
    // Unlike coverage, projection refuses an unknown language.
    resolveLocale(template, locale);
    assertLanguageVersion(template, locale, file);
    const stale = new Set(localeCoverage(template, locale, definitions).stale);
    // A stale entry's old text goes aside, so importing the file unchanged
    // can't stamp it with the current hash.
    const strings = localeStrings(template, locale, {
      definitions,
      doNotTranslate,
      syntax,
      only,
      blockId,
    }).strings.map(({ text, ...entry }): StringsFileEntry => {
      if (text === undefined) return entry;
      return stale.has(entry.id)
        ? { ...entry, previous: text }
        : { ...entry, text };
    });
    const data: StringsFile = {
      templatical: "strings/1",
      sourceLocale: defaultLocaleOf(template),
      targetLocale: locale,
      strings,
    };
    if (out) {
      const path = writeTemplateFile(out, data, cwd);
      note(`Wrote ${path}`);
      emit(
        {
          file: path,
          sourceLocale: data.sourceLocale,
          targetLocale: locale,
          count: strings.length,
        },
        () => `Exported ${strings.length} strings to ${path}`,
      );
    } else {
      emit(data, () => JSON.stringify(data, null, 2));
    }
    return EXIT.ok;
  }

  const data = readStringsFile(stringsFile!, cwd);
  if (data.sourceLocale !== defaultLocaleOf(template))
    throw new UsageError(
      `${stringsFile} was exported from "${data.sourceLocale}", but the default language of ${file} is "${defaultLocaleOf(template)}". Export the strings again.`,
    );
  resolveLocale(template, data.targetLocale);
  assertLanguageVersion(template, data.targetLocale, file);
  const options = { definitions, doNotTranslate, syntax };
  // Import re-masks defaults even when a stored translation has broken tags.
  const defaults = structuredClone(template);
  const hashes = new Map<string, string>();
  const captureDefaults = (
    target: Block | TemplateContent["settings"],
    prefix: string,
    paths: readonly string[],
  ) => {
    const layer = target.l10n?.[data.targetLocale];
    if (layer) delete layer.text;
    for (const path of paths) {
      const value = readPath(target, path);
      if (typeof value === "string")
        hashes.set(`${prefix}/${path}`, sourceHash(value));
    }
  };
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      captureDefaults(block, block.id, translatableFields(block, definitions));
      if (block.type === "section") block.children.forEach(walk);
      else if (block.type === "wrapper") walk(block.children);
    }
  };
  walk(defaults.blocks);
  captureDefaults(defaults.settings, "settings", SETTINGS_TRANSLATABLE_FIELDS);
  const current = localeStrings(defaults, data.targetLocale, {
    ...options,
    only: "all",
  });
  const fields = new Map(current.strings.map((entry) => [entry.id, entry]));
  const operations: Operation[] = [];
  const rejected: {
    id: string;
    reason:
      | "stale"
      | "tags_changed"
      | "unknown_field"
      | "not_translatable"
      | "unsafe_html";
  }[] = [];
  let applied = 0;
  for (const entry of data.strings) {
    if (entry.text === undefined) continue;
    const field = fields.get(entry.id);
    const hash = hashes.get(entry.id);
    if (hash !== undefined && hash !== entry.sourceHash) {
      rejected.push({ id: entry.id, reason: "stale" });
      continue;
    }
    const result = applyLocaleStrings(
      template,
      data.targetLocale,
      [{ ...entry, text: entry.text }],
      { ...options, tokens: current.tokens },
    );
    if (result.rejected.length) {
      rejected.push(...result.rejected);
      continue;
    }
    const tokens = current.tokens[entry.id];
    const restored = unmaskTags(entry.text, tokens)!;
    const source = field ? unmaskTags(field.source, tokens)! : "";
    if (
      field?.format === "html"
        ? !isSafeTranslationHtml(restored, source)
        : !isSafeTranslationText(restored, source)
    ) {
      rejected.push({ id: entry.id, reason: "unsafe_html" });
      continue;
    }
    operations.push(...result.operations);
    applied++;
  }
  const updated = applyOperations(template, operations);
  assertValid(updated);
  const path = writeTemplateFile(out ?? file, updated, cwd);
  emit({ applied, rejected, file: path }, () =>
    [
      `Applied ${applied} strings to ${path}`,
      ...rejected.map((entry) => `  - ${entry.id}: ${entry.reason}`),
    ].join("\n"),
  );
  return rejected.length ? EXIT.invalid : EXIT.ok;
}
