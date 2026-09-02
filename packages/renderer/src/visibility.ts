import type { Block } from "@templatical/types";

/**
 * Check if a block is hidden on all viewports.
 */
export function isHiddenOnAll(block: Block): boolean {
  const visibility = block.visibility;

  if (!visibility) {
    return false;
  }

  return !visibility.desktop && !visibility.mobile;
}

/**
 * Get the MJML css-class attribute string for a block.
 * Returns a string like ` css-class="tpl-hide-desktop"` or empty string.
 *
 * `extraClasses` are appended to the visibility classes on the *same*
 * attribute. MJML keeps only one `css-class` per element, so a caller needing
 * both must merge here rather than emitting a second attribute.
 */
export function getCssClassAttr(
  block: Block,
  extraClasses: string[] = [],
): string {
  const classes = [getCssClasses(block), ...extraClasses]
    .filter((entry) => entry !== "")
    .join(" ");

  if (classes === "") {
    return "";
  }

  return ` css-class="${classes}"`;
}

/**
 * Get the CSS classes for visibility hiding.
 */
export function getCssClasses(block: Block): string {
  const visibility = block.visibility;

  if (!visibility) {
    return "";
  }

  const classes: string[] = [];

  if (!visibility.desktop) {
    classes.push("tpl-hide-desktop");
  }

  if (!visibility.mobile) {
    classes.push("tpl-hide-mobile");
  }

  return classes.join(" ");
}
