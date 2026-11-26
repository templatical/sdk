import type { Directive } from "vue";

type FontResolver = (family: string) => string;

/** Apply display-only font stacks to sanitized rich text on the canvas. */
function resolveCanvasFonts(root: HTMLElement, resolve: FontResolver): void {
  for (const element of root.querySelectorAll<HTMLElement>("[style]")) {
    const family = element.dataset.tplInlineFont ?? element.style.fontFamily;
    if (!family) continue;
    element.dataset.tplInlineFont = family;
    element.style.setProperty(
      "font-family",
      resolve(family),
      element.style.getPropertyPriority("font-family"),
    );
  }
}

export const vInlineFontFallbacks: Directive<HTMLElement, FontResolver> = {
  mounted(element, binding) {
    resolveCanvasFonts(element, binding.value);
  },
  updated(element, binding) {
    resolveCanvasFonts(element, binding.value);
  },
};
