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

function compact(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Catalog caption: first init() key, omitted when it restates the title. */
export function catalogInitKey(title: string, snippet: string): string | null {
  const key = snippetChipKeys(snippet)[0];
  if (!key) return null;
  const titleSlug = compact(title);
  const keySlug = compact(key);
  if (titleSlug === keySlug) return null;
  if (titleSlug.length >= 4 && keySlug.endsWith(titleSlug)) return null;
  return key;
}
