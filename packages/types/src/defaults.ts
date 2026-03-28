import type {
  ButtonBlock,
  CountdownBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  SectionBlock,
  SocialIconsBlock,
  SpacerBlock,
  TableBlock,
  TextBlock,
  VideoBlock,
} from "./blocks";
import type { TemplateSettings } from "./template";

type BlockDefaultsFor<T> = Partial<Omit<T, "id" | "type">>;

export interface BlockDefaults {
  text?: BlockDefaultsFor<TextBlock>;
  image?: BlockDefaultsFor<ImageBlock>;
  button?: BlockDefaultsFor<ButtonBlock>;
  divider?: BlockDefaultsFor<DividerBlock>;
  section?: BlockDefaultsFor<SectionBlock>;
  video?: BlockDefaultsFor<VideoBlock>;
  social?: BlockDefaultsFor<SocialIconsBlock>;
  spacer?: BlockDefaultsFor<SpacerBlock>;
  html?: BlockDefaultsFor<HtmlBlock>;
  menu?: BlockDefaultsFor<MenuBlock>;
  table?: BlockDefaultsFor<TableBlock>;
  countdown?: BlockDefaultsFor<CountdownBlock>;
}

export type TemplateDefaults = Partial<TemplateSettings>;

// ---------------------------------------------------------------------------
// Built-in default values — single source of truth for factories & consumers
// ---------------------------------------------------------------------------

export const TEXT_BLOCK_DEFAULTS: BlockDefaultsFor<TextBlock> = {
  content: "<p>Enter your text here</p>",
  fontSize: 16,
  color: "#1a1a1a",
  textAlign: "left",
  fontWeight: "normal",
};

export const IMAGE_BLOCK_DEFAULTS: BlockDefaultsFor<ImageBlock> = {
  src: "",
  alt: "",
  width: "full",
  align: "center",
};

export const BUTTON_BLOCK_DEFAULTS: BlockDefaultsFor<ButtonBlock> = {
  text: "Click Here",
  url: "",
  backgroundColor: "#333333",
  textColor: "#ffffff",
  borderRadius: 6,
  fontSize: 15,
  buttonPadding: { top: 12, right: 24, bottom: 12, left: 24 },
};

export const DIVIDER_BLOCK_DEFAULTS: BlockDefaultsFor<DividerBlock> = {
  lineStyle: "solid",
  color: "#e0e0e0",
  thickness: 1,
  width: "full",
};

export const SECTION_BLOCK_DEFAULTS: BlockDefaultsFor<SectionBlock> = {
  columns: "1",
};

export const VIDEO_BLOCK_DEFAULTS: BlockDefaultsFor<VideoBlock> = {
  url: "",
  thumbnailUrl: "",
  alt: "Video",
  width: "full",
  align: "center",
};

export const SOCIAL_ICONS_BLOCK_DEFAULTS: BlockDefaultsFor<SocialIconsBlock> = {
  iconStyle: "solid",
  iconSize: "medium",
  spacing: 10,
  align: "center",
};

export const SPACER_BLOCK_DEFAULTS: BlockDefaultsFor<SpacerBlock> = {
  height: 24,
};

export const HTML_BLOCK_DEFAULTS: BlockDefaultsFor<HtmlBlock> = {
  content: "",
};

export const MENU_BLOCK_DEFAULTS: BlockDefaultsFor<MenuBlock> = {
  fontSize: 15,
  color: "#1a1a1a",
  textAlign: "center",
  separator: "|",
  separatorColor: "#e0e0e0",
  spacing: 10,
};

export const TABLE_BLOCK_DEFAULTS: BlockDefaultsFor<TableBlock> = {
  hasHeaderRow: true,
  borderColor: "#e0e0e0",
  borderWidth: 1,
  cellPadding: 8,
  fontSize: 15,
  color: "#1a1a1a",
  textAlign: "left",
};

export const COUNTDOWN_BLOCK_DEFAULTS: BlockDefaultsFor<CountdownBlock> = {
  targetDate: "",
  timezone: "UTC",
  showDays: true,
  showHours: true,
  showMinutes: true,
  showSeconds: true,
  separator: ":",
  digitFontSize: 32,
  digitColor: "#1a1a1a",
  labelColor: "#6b7280",
  labelFontSize: 12,
  backgroundColor: "#ffffff",
  labelDays: "Days",
  labelHours: "Hours",
  labelMinutes: "Minutes",
  labelSeconds: "Seconds",
  expiredMessage: "This offer has expired",
  expiredImageUrl: "",
  hideOnExpiry: false,
};

export const DEFAULT_BLOCK_DEFAULTS: Required<BlockDefaults> = {
  text: TEXT_BLOCK_DEFAULTS,
  image: IMAGE_BLOCK_DEFAULTS,
  button: BUTTON_BLOCK_DEFAULTS,
  divider: DIVIDER_BLOCK_DEFAULTS,
  section: SECTION_BLOCK_DEFAULTS,
  video: VIDEO_BLOCK_DEFAULTS,
  social: SOCIAL_ICONS_BLOCK_DEFAULTS,
  spacer: SPACER_BLOCK_DEFAULTS,
  html: HTML_BLOCK_DEFAULTS,
  menu: MENU_BLOCK_DEFAULTS,
  table: TABLE_BLOCK_DEFAULTS,
  countdown: COUNTDOWN_BLOCK_DEFAULTS,
};

export const DEFAULT_TEMPLATE_DEFAULTS: TemplateDefaults = {
  width: 600,
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function deepMergeDefaults<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T>,
): T {
  const result = { ...base };

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const baseVal = base[key];
    const overrideVal = overrides[key];

    if (overrideVal === undefined) {
      continue;
    }

    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMergeDefaults(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = overrideVal as T[keyof T];
    }
  }

  return result;
}
