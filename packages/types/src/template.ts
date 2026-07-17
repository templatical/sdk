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
