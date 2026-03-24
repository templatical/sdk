import type { Block } from '@templatical/types';

/**
 * Check if a block is hidden on all viewports.
 */
export function isHiddenOnAll(block: Block): boolean {
  const visibility = block.visibility;

  if (!visibility) {
    return false;
  }

  return !visibility.desktop && !visibility.tablet && !visibility.mobile;
}

/**
 * Get the MJML css-class attribute string for visibility hiding.
 * Returns a string like ` css-class="tpl-hide-desktop tpl-hide-tablet"` or empty string.
 */
export function getCssClassAttr(block: Block): string {
  const classes = getCssClasses(block);

  if (classes === '') {
    return '';
  }

  return ` css-class="${classes}"`;
}

/**
 * Get the CSS classes for visibility hiding.
 */
export function getCssClasses(block: Block): string {
  const visibility = block.visibility;

  if (!visibility) {
    return '';
  }

  const classes: string[] = [];

  if (!visibility.desktop) {
    classes.push('tpl-hide-desktop');
  }

  if (!visibility.tablet) {
    classes.push('tpl-hide-tablet');
  }

  if (!visibility.mobile) {
    classes.push('tpl-hide-mobile');
  }

  return classes.join(' ');
}
