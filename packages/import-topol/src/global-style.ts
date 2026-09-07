import { DEFAULT_TEMPLATE_DEFAULTS } from "@templatical/types";
import type { TemplateContent, TemplateSettings } from "@templatical/types";
import {
  attr,
  parseColor,
  parseFontFamily,
  parsePxValue,
} from "./attribute-parser";
import type { TopolDesign, TopolNode } from "./types";

/**
 * `DEFAULT_TEMPLATE_DEFAULTS` is typed `Partial<TemplateSettings>` so a
 * consumer can override any subset, but its own literal always sets the six
 * required fields. Narrowing once here is what lets each read come out as
 * `number`/`string`/`boolean` rather than `| undefined`. A plain typed
 * assignment cannot substitute: `Partial<T>` is not assignable to
 * `Required<Pick<T, …>>`, so `tsc` rejects it outright.
 */
const REQUIRED_DEFAULTS = DEFAULT_TEMPLATE_DEFAULTS as Required<
  Pick<
    TemplateSettings,
    | "width"
    | "backgroundColor"
    | "textColor"
    | "linkUnderline"
    | "fontFamily"
    | "locale"
  >
>;

export interface GlobalStyle {
  settings: TemplateContent["settings"];
  /** From nested objects like `"mj-text": { … }`. */
  tagDefaults: Record<string, Record<string, string>>;
  /** From flat `<selector>:<property>` keys; the bare selector is `""`. */
  selectorDefaults: Record<string, Record<string, string>>;
}

/** A per-tag default, or undefined when the design sets none. */
export function tagDefault(
  style: GlobalStyle,
  tag: string,
  key: string,
): string | undefined {
  return style.tagDefaults[tag]?.[key];
}

/** A per-selector default (`""` is the document default), or undefined. */
export function selectorDefault(
  style: GlobalStyle,
  selector: string,
  key: string,
): string | undefined {
  return style.selectorDefaults[selector]?.[key];
}

const NON_SELECTOR_KEYS = new Set(["containerWidth", "fonts"]);

/**
 * Split the root's `attributes` into settings, per-tag defaults and
 * per-selector defaults.
 *
 * The root mixes two idioms: `<selector>:<property>` flat keys (`:color`,
 * `a:color`, `h1:font-family`) and `<tag>: { … }` nested objects, which are
 * the analogue of MJML's `mj-attributes`.
 */
export function readGlobalStyle(
  root: TopolDesign,
  container: TopolNode | undefined,
  warnings: string[],
): GlobalStyle {
  const tagDefaults: Record<string, Record<string, string>> = Object.create(
    null,
  );
  const selectorDefaults: Record<
    string,
    Record<string, string>
  > = Object.create(null);

  for (const [key, value] of Object.entries(root.attributes ?? {})) {
    if (NON_SELECTOR_KEYS.has(key)) continue;

    if (value !== null && typeof value === "object") {
      const bucket = (tagDefaults[key] ??= Object.create(null));
      for (const [k, v] of Object.entries(value)) {
        if (v !== null && v !== undefined) bucket[k] = String(v);
      }
      continue;
    }

    const colon = key.indexOf(":");
    if (colon === -1) continue;
    const selector = key.slice(0, colon);
    const property = key.slice(colon + 1);
    if (value === null || value === undefined) continue;
    const bucket = (selectorDefaults[selector] ??= Object.create(null));
    bucket[property] = String(value);
  }

  const width =
    parsePxValue(attr(root, "containerWidth")) || REQUIRED_DEFAULTS.width;

  // containerWidth is authored only here, on the root. It is also denormalised
  // onto every leaf as the enclosing column's computed width (600/300/150 in
  // one template), so no other module may read it. See the Global Constraints.

  const backgroundColor =
    (container ? parseColor(attr(container, "background-color")) : "") ||
    REQUIRED_DEFAULTS.backgroundColor;

  const textColor =
    parseColor(selectorDefaults[""]?.color) || REQUIRED_DEFAULTS.textColor;

  const fontFamily =
    parseFontFamily(selectorDefaults[""]?.["font-family"]) ||
    parseFontFamily(attr(root, "fonts")) ||
    REQUIRED_DEFAULTS.fontFamily;

  const linkColor = parseColor(selectorDefaults["a"]?.color);

  const lineHeight = selectorDefaults[""]?.["line-height"];
  if (lineHeight !== undefined) {
    warnings.push(
      `Dropped the document line-height (${lineHeight}) — Templatical has no document-level line-height setting.`,
    );
  }

  const settings: TemplateContent["settings"] = {
    width,
    backgroundColor,
    textColor,
    linkUnderline: REQUIRED_DEFAULTS.linkUnderline,
    fontFamily,
    locale: REQUIRED_DEFAULTS.locale,
    ...(linkColor ? { linkColor } : {}),
  };

  return { settings, tagDefaults, selectorDefaults };
}
