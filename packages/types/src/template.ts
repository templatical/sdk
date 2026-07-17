import type { Block } from "./blocks";
import { DEFAULT_TEMPLATE_DEFAULTS } from "./defaults";
import type { TemplateDefaults } from "./defaults";

export interface TemplateSettings {
  width: number;
  backgroundColor: string;
  /**
   * Document-level default text color: the `<mj-text>` default in the rendered
   * MJML, inherited by every text block (Title, Paragraph, Menu, Table) that
   * doesn't set its own `color`. Required, defaulting to `#1a1a1a` (see
   * `DEFAULT_TEMPLATE_DEFAULTS`); customize the default per-consumer via
   * `templateDefaults`. A block's explicit `color` or an inline text-color
   * mark overrides it.
   */
  textColor: string;
  /**
   * Document-level link color: emitted as the global `a { color }` rule in the
   * rendered MJML, so it cascades to every link — rich-text and menu alike.
   * Optional: when unset, links inherit the surrounding text color
   * (`color: inherit`), preserving the pre-#352 default. A per-block or
   * per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still
   * overrides it.
   */
  linkColor?: string;
  /**
   * Whether links are underlined document-wide: drives the global
   * `a { text-decoration }` rule (`underline` when true, `none` when false).
   * Required, defaulting to `true` (see `DEFAULT_TEMPLATE_DEFAULTS`) — the
   * common, more accessible email default. Applies to body (rich-text) links;
   * buttons and menu items carry their own inline `text-decoration` and are
   * unaffected. Set `false` to render links without an underline.
   */
  linkUnderline: boolean;
  fontFamily: string;
  preheaderText?: string;
  /**
   * BCP-47 language code for the rendered email's `<html lang>`. Drives
   * screen-reader pronunciation. Default `'en'` via `DEFAULT_TEMPLATE_DEFAULTS`.
   */
  locale: string;
}

export interface TemplateContent {
  blocks: Block[];
  settings: TemplateSettings;
}

export function createDefaultTemplateContent(
  defaultFontFamily = "Arial",
  templateDefaults?: TemplateDefaults,
): TemplateContent {
  return {
    blocks: [],
    settings: {
      ...DEFAULT_TEMPLATE_DEFAULTS,
      fontFamily: defaultFontFamily,
      ...templateDefaults,
    } as TemplateSettings,
  };
}
