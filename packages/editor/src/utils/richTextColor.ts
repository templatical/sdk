import { DEFAULT_TEXT_COLOR } from "../constants/styleConstants";

/**
 * The color a rich-text selection actually renders as, for display in the
 * text-color control (issue #373).
 *
 * Priority: an explicit inline text-color mark on the selection wins; otherwise
 * the text inherits the document-level `textColor`; if that too is unset (older
 * content predating document text color), fall back to the built-in default.
 *
 * A native `<input type="color">` can't represent "no color", so the control
 * must be handed a concrete value. Resolving the effective color is what keeps
 * that value truthful — the swatch shows the color the text actually renders in,
 * whatever level it comes from. Defaulting to a hard-coded `#000000` instead
 * would both read as an explicit choice and not even match the real inherited
 * color (`#1a1a1a`).
 */
export function resolveEffectiveTextColor(
  explicitColor: string,
  documentTextColor: string | undefined,
): string {
  return explicitColor || documentTextColor || DEFAULT_TEXT_COLOR;
}
