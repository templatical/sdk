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
 * shifts that exponent instead of appending a second one. A non-finite
 * value, or a shift that is not finite, returns the input unchanged.
 */
export function roundHundredths(value: number): number {
  if (!Number.isFinite(value)) return value;
  const shifted = shiftDecimal(value, 2);
  if (!Number.isFinite(shifted)) return value;
  // `Math.round` of a finite number is finite, and shifting it back by two
  // places stays finite: the +2 shift already returned when it overflowed.
  return shiftDecimal(Math.round(shifted), -2);
}

/**
 * Move the decimal point by `places`. Callers pass a finite value and a
 * literal `places`. A finite number's string is a decimal or one exponent.
 */
function shiftDecimal(value: number, places: number): number {
  const text = String(value);
  const exponential = /^(-?\d+(?:\.\d+)?)e([+-]?\d+)$/i.exec(text);
  if (exponential) {
    const exponent = Number(exponential[2]) + places;
    return Number(`${exponential[1]}e${exponent}`);
  }
  return Number(`${text}e${places}`);
}
