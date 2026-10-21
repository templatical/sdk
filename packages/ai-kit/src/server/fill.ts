/**
 * Replace `{name}` placeholders in one pass. Filled-in values are never read
 * again, so a user's text holding `{block}` stays as it is.
 */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}
