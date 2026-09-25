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
