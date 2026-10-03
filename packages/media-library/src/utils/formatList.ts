/**
 * Joins labels the way the UI locale writes a list (`、` in Japanese, `, `
 * elsewhere). `locale` is free-text consumer config, so a malformed tag falls
 * back to the runtime locale instead of throwing mid-render.
 */
export function formatList(items: string[], locale?: string): string {
  // `unit` would be the natural type, but its Japanese form separates with
  // spaces; narrow `conjunction` gives `、` there and `A, B, C` in English.
  const options: Intl.ListFormatOptions = {
    style: "narrow",
    type: "conjunction",
  };
  try {
    return new Intl.ListFormat(locale, options).format(items);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    return new Intl.ListFormat(undefined, options).format(items);
  }
}
