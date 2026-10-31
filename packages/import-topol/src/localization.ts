import { isLocaleTag, sourceHash } from "@templatical/types";
import type {
  Block,
  BlockLocaleLayer,
  TemplateContent,
} from "@templatical/types";

type Target = { l10n?: Record<string, BlockLocaleLayer> };

export function warn(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message);
}

export function localeTag(value: string, warnings: string[]): string | null {
  const locale = value.replaceAll("_", "-");
  if (isLocaleTag(locale)) return locale;
  warn(warnings, `Dropped language "${value}": unsupported language tag.`);
  return null;
}

/** The `defaultLocale` option as a tag; `null`, with a warning, when it isn't one. */
export function defaultLocaleOption(
  value: string | undefined,
  warnings: string[],
): string | null {
  if (!value) return null;
  const locale = value.replaceAll("_", "-");
  if (isLocaleTag(locale)) return locale;
  warn(
    warnings,
    `Ignored defaultLocale "${value}": unsupported language tag. Used "en".`,
  );
  return null;
}

export function text(
  target: Target,
  locale: string,
  path: string,
  base: string | undefined,
  value: string,
): void {
  if (base === undefined) {
    set(target, locale, path, value);
    return;
  }
  const layer = ((target.l10n ??= {})[locale] ??= {});
  (layer.text ??= {})[path] = { value, sourceHash: sourceHash(base) };
}

export function set(
  target: Target,
  locale: string,
  path: string,
  value: unknown,
): void {
  const layer = ((target.l10n ??= {})[locale] ??= {});
  (layer.set ??= {})[path] = value;
}

/** Register only non-default versions, leaving single-language imports unchanged. */
export function registerLocales(content: TemplateContent): void {
  const locales = new Set<string>();
  const visit = (target: Target) => {
    if (!target.l10n) return;
    delete target.l10n[content.settings.locale];
    for (const locale of Object.keys(target.l10n)) locales.add(locale);
    if (Object.keys(target.l10n).length === 0) delete target.l10n;
  };
  visit(content.settings);
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      visit(block);
      if (block.type === "section") block.children.forEach(walk);
    }
  };
  walk(content.blocks);
  if (locales.size) content.settings.locales = [...locales];
}
