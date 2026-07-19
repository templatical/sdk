import { DEFAULT_TEXT_COLOR } from "../constants/styleConstants";

/**
 * The color a rich-text selection actually renders as, for display in the
 * text-color control (issue #373).
 *
 * Priority: an explicit inline text-color mark on the selection wins; otherwise
 * the text inherits the document-level `textColor`; if that too is unset (older
 * content predating document text color), fall back to the built-in default.
 *
 * A native `<input type="color">` can't represent "no color", so before this it
 * always painted a hard-coded `#000000` when no inline mark existed — which both
 * looked like an explicit choice and didn't even match the real inherited color
 * (`#1a1a1a`). Resolving the effective color keeps the swatch truthful: it shows
 * the color the text is actually rendered in, whatever level it comes from.
 */
export function resolveEffectiveTextColor(
  explicitColor: string,
  documentTextColor: string | undefined,
): string {
  return explicitColor || documentTextColor || DEFAULT_TEXT_COLOR;
}
