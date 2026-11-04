import type { SpacingValue } from "@templatical/types";
import { escapeAttr } from "./escape";

/**
 * Convert a SpacingValue to a CSS padding string like "10px 10px 10px 10px".
 */
export function toPaddingString(padding: SpacingValue): string {
  return escapeAttr(
    `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
  );
}
