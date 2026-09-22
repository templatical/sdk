export function configKeys(config: object): string[] {
  return Object.keys(config).filter(
    (k) => (config as Record<string, unknown>)[k] !== undefined,
  );
}

export function snippetContainsKeys(snippet: string, keys: string[]): string[] {
  return keys.filter(
    (key) => !new RegExp(String.raw`(?:^|[\s,{])${key}\s*:`).test(snippet),
  );
}

/** init() keys shown as catalog chips. Order is display order. */
export const SNIPPET_CHIP_KEYS = [
  "savedBlocks",
  "templates",
  "versionHistory",
  "comments",
  "media",
  "testEmail",
  "render",
  "mergeTags",
  "logicTags",
  "displayConditions",
  "customBlocks",
  "resolvePreview",
  "fonts",
  "theme",
  "locale",
  "shadowDom",
  "lint",
  "htmlBlockPreview",
  "colors",
  "blockDefaults",
  "templateDefaults",
] as const;

export function snippetChipKeys(snippet: string): string[] {
  return SNIPPET_CHIP_KEYS.filter(
    (key) => snippetContainsKeys(snippet, [key]).length === 0,
  );
}
