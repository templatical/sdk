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
 * shifts that exponent instead of appending a second one. A shift or a
 * result that is not finite, or an exponent string that cannot be formed,
 * returns the input unchanged.
 */
export function roundHundredths(value: number): number {
  if (!Number.isFinite(value)) return value;
  const shifted = shiftDecimal(value, 2);
  if (!Number.isFinite(shifted)) return value;
  const rounded = Math.round(shifted);
  if (!Number.isFinite(rounded)) return value;
  const result = shiftDecimal(rounded, -2);
  return Number.isFinite(result) ? result : value;
}

/**
 * Move the decimal point by `places`. `NaN` when `value` is not finite or
 * its exponent string cannot be formed, so the caller can keep the input.
 */
function shiftDecimal(value: number, places: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(places)) return Number.NaN;
  const text = String(value);
  const exponential = /^(-?\d+(?:\.\d+)?)e([+-]?\d+)$/i.exec(text);
  if (exponential) {
    const exponent = Number(exponential[2]) + places;
    if (!Number.isFinite(exponent)) return Number.NaN;
    return Number(`${exponential[1]}e${exponent}`);
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return Number.NaN;
  return Number(`${text}e${places}`);
}
