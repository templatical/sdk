import type {
  Block,
  CustomBlockDefinition,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";

export interface LocalizedText {
  value: string;
  /** `sourceHash(defaultValue)` when the value was written or kept. */
  sourceHash: string;
}

/** One language's layer on a block. Members are omitted when empty. */
export interface BlockLocaleLayer {
  /** Translated text, by field path. */
  text?: Record<string, LocalizedText>;
  /** Any other property overridden for this language, by field path. */
  set?: Record<string, unknown>;
  /** The block is left out of this language. */
  hidden?: true;
}

/** One language's layer on the template settings. */
export interface SettingsLocaleLayer {
  text?: Record<string, LocalizedText>;
  set?: Record<string, unknown>;
}

export declare const TRANSLATABLE_FIELDS: Readonly<
  Record<string, readonly string[]>
>;
export declare const SETTINGS_TRANSLATABLE_FIELDS: readonly string[];
export declare function translatableFields(
  block: Block,
  definitions?: readonly CustomBlockDefinition[],
): string[];
export declare function readPath(target: unknown, path: string): unknown;
export declare function sourceHash(value: string): string;
export declare function localizeBlock(
  block: Block,
  locale: string,
  defaultLocale: string,
): Block;
export declare function resolveLocale(
  content: TemplateContent,
  locale: string,
): TemplateContent;
export interface LocaleCoverage {
  translated: string[];
  missing: string[];
  stale: string[];
}
export declare function localeCoverage(
  content: TemplateContent,
  locale: string,
  definitions?: readonly CustomBlockDefinition[],
): LocaleCoverage;
export declare function defaultLocaleOf(content: TemplateContent): string;
export declare function isLocaleTag(value: unknown): value is string;
export declare function isSafePath(path: string): boolean;
export declare function isTranslatablePath(
  blockType: string,
  path: string,
): boolean;
export declare function writePath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): boolean;

export interface AddLocaleOperation {
  op: "addLocale";
  locale: string;
  /** Index in `settings.locales` to insert at; default the end. Undo uses it to restore order. */
  position?: number;
}

export interface RemoveLocaleOperation {
  op: "removeLocale";
  locale: string;
  /** Guard: the locale's block and settings layers must match exactly; absent means no layer. */
  expect?: {
    blocks: Record<string, BlockLocaleLayer>;
    settings?: SettingsLocaleLayer;
  };
}

export interface LocaleLayerExpect {
  text?: Record<string, LocalizedText | null>;
  /** `null` matches an absent override. */
  set?: Record<string, unknown>;
  hidden?: boolean;
}

export interface UpdateBlockLocaleOperation {
  op: "updateBlockLocale";
  blockId: string;
  locale: string;
  text?: Record<string, LocalizedText>;
  set?: Record<string, unknown>;
  unset?: string[];
  hidden?: boolean;
  expect?: LocaleLayerExpect;
}

export interface UpdateSettingsLocaleOperation {
  op: "updateSettingsLocale";
  locale: string;
  text?: Record<string, LocalizedText>;
  set?: Record<string, unknown>;
  unset?: string[];
  expect?: Omit<LocaleLayerExpect, "hidden">;
}

export declare function pruneLocaleOrphans(block: Block): Block;
export declare function pruneSettingsLocaleOrphans(
  settings: TemplateSettings,
): TemplateSettings;
export declare function isStructuralLocalePath(
  block: Block,
  path: string,
  value?: unknown,
): boolean;
