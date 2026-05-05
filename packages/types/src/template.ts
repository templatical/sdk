import type { Block } from "./blocks";
import { DEFAULT_TEMPLATE_DEFAULTS } from "./defaults";
import type { TemplateDefaults } from "./defaults";

export interface TemplateSettings {
  width: number;
  backgroundColor: string;
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
