/**
 * The schema pattern on `PercentWidth`: a share from `"0%"` to `"100%"`.
 */
export const PERCENT_WIDTH_PATTERN = /^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%$/;

/**
 * The number in a `PercentWidth` string when it is above 0 and at most 100.
 * Anything else is `null`, and the button fits its label.
 */
export function parsePercentWidth(value: unknown): number | null {
  if (typeof value !== "string" || !PERCENT_WIDTH_PATTERN.test(value)) {
    return null;
  }
  const share = Number(value.slice(0, -1));
  if (!(share > 0 && share <= 100)) return null;
  return share;
}

/**
 * Two decimal places. A decimal-exponent shift rounds a midpoint such as
 * `0.145` to `0.15`. A value whose string is already an exponent (`1e-7`)
 * shifts that exponent instead of appending a second one.
 */
export function roundHundredths(value: number): number {
  if (!Number.isFinite(value)) return value;
  const text = String(value);
  const exponential = /^(-?\d+(?:\.\d+)?)e([+-]?\d+)$/i.exec(text);
  const shifted = exponential
    ? Number(`${exponential[1]}e${Number(exponential[2]) + 2}`)
    : Number(`${text}e2`);
  return Number(`${Math.round(shifted)}e-2`);
}
