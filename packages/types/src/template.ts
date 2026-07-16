import type { Block } from "./blocks";
import { DEFAULT_TEMPLATE_DEFAULTS } from "./defaults";
import type { TemplateDefaults } from "./defaults";

export interface TemplateSettings {
  width: number;
  backgroundColor: string;
  /**
   * Document-level default text color, applied as the `<mj-text>` default in
   * the rendered MJML. Blocks inherit it unless they set their own color (e.g.
   * a Title's `color`) or carry an inline text-color mark. Optional — when
   * unset, text falls back to the renderer/MJML default with no document
   * override, keeping existing templates unchanged.
   */
  textColor?: string;
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
