import {
  defaultLocaleOption,
  localeTag,
  registerLocales,
  set,
  text,
  warn,
} from "./localization";
import { convertLeaf } from "./block-mapper";
import { createDefaultTemplateContent } from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { readGlobalStyle } from "./global-style";
import { buildSection } from "./section-builder";
import type { MapContext } from "./block-mapper";
import type {
  ImportReport,
  ImportReportEntry,
  ImportResult,
  TopolDesign,
} from "./types";

export interface ConvertTopolOptions {
  /** Used when the source declares no default language. */
  defaultLocale?: string;
}

const ROOT_TAG = "mj-global-style";

const INVALID_DESIGN_MESSAGE =
  'Invalid Topol template: expected the design JSON object — Topol hands you this directly from its editor\'s onSave callback, or under "definition" (template API) or "json" (predefined-templates API) in its API response.';

const EMPTY_DESIGN_WARNING =
  "No convertible content was found in the Topol design. Check that the mj-container holds at least one mj-section.";

/**
 * Convert a Topol.io design into a Templatical template.
 *
 * The input is the design object itself — the node whose `tagName` is
 * `mj-global-style`, not a whole API response. Topol's editor hands it to
 * you directly as the first argument to `onSave`; its REST APIs wrap it
 * instead, under `definition` on the template-retrieval endpoint or `json`
 * (alongside `html`) on the predefined-templates endpoint. That is
 * documented rather than sniffed: guessing which field holds the design
 * risks importing an envelope's `html`, which belongs to a different
 * package entirely.
 *
 * @example
 * ```ts
 * const { content, report } = convertTopolTemplate(design);
 * const editor = init({ container: '#editor', content });
 * console.log(report.summary);
 * ```
 */
export function convertTopolTemplate(
  design: TopolDesign | string,
  options: ConvertTopolOptions = {},
): ImportResult {
  const root: unknown = typeof design === "string" ? safeParse(design) : design;

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw new Error(INVALID_DESIGN_MESSAGE);
  }

  const topolDesign = root as TopolDesign;

  if (topolDesign.tagName !== ROOT_TAG) {
    // Topol's REST APIs wrap the design rather than returning it bare: the
    // template-retrieval endpoint uses "definition", the predefined/premade
    // templates endpoint uses "json" (alongside "html"). A response object
    // passed here by mistake still carries one of those keys, so that
    // mistake is named directly instead of falling through to the generic
    // wrong-tagName message below.
    if ("json" in topolDesign || "definition" in topolDesign) {
      throw new Error(INVALID_DESIGN_MESSAGE);
    }
    throw new Error(
      `Invalid Topol template: expected a root node with tagName "${ROOT_TAG}".`,
    );
  }

  const container = (topolDesign.children ?? []).find(
    (child) => child.tagName === "mj-container",
  );

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  const style = readGlobalStyle(topolDesign, container, warnings);
  const languages = topolDesign.langs ?? [];
  const primary =
    languages.find((language) => language.primary) ?? languages[0];
  style.settings.locale =
    (primary ? localeTag(primary.key, warnings) : null) ??
    defaultLocaleOption(options.defaultLocale, warnings) ??
    "en";
  const uidMap: NonNullable<MapContext["uidMap"]> = new Map();

  const ctx: MapContext = {
    uidMap,
    style,
    columnWidth: style.settings.width,
  };

  for (const child of container?.children ?? []) {
    if (child.tagName !== "mj-section") continue;
    blocks.push(...buildSection(child, ctx, entries));
  }

  if (blocks.length === 0) {
    warnings.push(EMPTY_DESIGN_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: style.settings,
  };

  const preview = primary?.translations?.["mj-preview"]?.content;
  if (typeof preview === "string") content.settings.preheaderText = preview;
  for (const language of languages) {
    const locale = localeTag(language.key, warnings);
    if (!locale) continue;
    for (const [uid, translation] of Object.entries(
      language.translations ?? {},
    )) {
      if (uid === "mj-subject") {
        warn(
          warnings,
          `Dropped language "${locale}" mj-subject: the host owns this field.`,
        );
        continue;
      }
      if (locale === content.settings.locale) continue;
      if (uid === "mj-preview") {
        if (typeof translation.content === "string")
          text(
            content.settings,
            locale,
            "preheaderText",
            content.settings.preheaderText,
            translation.content,
          );
        continue;
      }
      const target = uidMap.get(uid);
      const block = target?.block;
      if (!block || block.type === "html") {
        warn(
          warnings,
          `Dropped language "${locale}" translation for uid "${uid}": target converted to ${block ? "HTML fallback" : "null"}.`,
        );
        continue;
      }
      if (typeof translation.content === "string") {
        const converted = convertLeaf(
          { ...target.node, content: translation.content },
          ctx,
        )?.block;
        if (
          (block.type === "title" || block.type === "paragraph") &&
          converted &&
          (converted.type === "title" || converted.type === "paragraph")
        )
          text(block, locale, "content", block.content, converted.content);
        else if (block.type === "button" && converted?.type === "button")
          text(block, locale, "text", block.text, converted.text);
        else
          warn(
            warnings,
            `Dropped language "${locale}" content for uid "${uid}": no language mapping for this format.`,
          );
      }
      for (const [key, value] of Object.entries(translation.attributes ?? {})) {
        if (typeof value !== "string") continue;
        if (key === "alt" && block.type === "image")
          text(block, locale, "alt", block.alt, value);
        else if (key === "href" && block.type === "button")
          set(block, locale, "url", value);
        else if (key === "href" && block.type === "image")
          set(block, locale, "linkUrl", value);
        else if (key === "src" && block.type === "image")
          set(block, locale, "src", value);
        else
          warn(
            warnings,
            `Dropped language "${locale}" attribute "${key}" for uid "${uid}": no language mapping for this format.`,
          );
      }
    }
  }
  registerLocales(content);
  const versions = languages
    .map((language) => localeTag(language.key, warnings))
    .filter(
      (locale): locale is string =>
        locale !== null && locale !== content.settings.locale,
    );
  if (versions.length) content.settings.locales = [...new Set(versions)];

  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  const report: ImportReport = { entries, warnings, summary };

  return { content, report };
}

function safeParse(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(INVALID_DESIGN_MESSAGE);
  }
}
