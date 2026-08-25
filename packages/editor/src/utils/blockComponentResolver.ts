import type { Block, TemplateSettings } from "@templatical/types";
import type { Component } from "vue";
import type { UseBlockRegistryReturn } from "../composables/useBlockRegistry";

/**
 * Document-level style the blocks inherit — the canvas equivalent of the
 * exported `<mj-attributes>` defaults and global `a { … }` rule, so what the
 * editor shows matches what gets sent.
 *
 * Belongs on whatever element wraps a set of rendered blocks. Every surface
 * that renders blocks must apply it, not just the main canvas: without it the
 * link rules in `styles/index.css` fall through to their unset defaults
 * (`text-decoration: none`, `color: inherit`) and the font drops to the editor
 * UI's, so the same paragraph renders differently in a preview than on the
 * canvas. Set only what's configured — an unset value must stay unset so it
 * matches the renderer omitting the attribute.
 *
 * `settings.backgroundColor` deliberately does NOT belong here. The canvas
 * applies this to `.tpl-canvas`, which has to stay transparent so the
 * invertible `.tpl-canvas-bg` layer beneath it shows through; a background here
 * would double-paint and defeat the dark-mode preview. Each surface paints the
 * body colour on its own stage instead.
 */
export function getDocumentStyle(
  settings: TemplateSettings,
): Record<string, string> {
  const style: Record<string, string> = {
    fontFamily: settings.fontFamily,
  };
  // Titles carry their own inline color and override this, same as in export.
  if (settings.textColor) {
    style.color = settings.textColor;
  }
  // Consumed by the `.tpl-text-content a` rules; unset falls back to `inherit`
  // (the surrounding text color), exactly how an unstyled link exports.
  if (settings.linkColor) {
    style["--tpl-doc-link-color"] = settings.linkColor;
  }
  // Only set when true; the CSS fallback (`none`) covers false and the legacy
  // undefined case, matching the export's default.
  if (settings.linkUnderline) {
    style["--tpl-doc-link-underline"] = "underline";
  }
  return style;
}

/**
 * Resolves a block to its Vue component, checking the registry first
 * and falling back to the provided component map.
 */
export function resolveBlockComponent(
  block: Block,
  registry: UseBlockRegistryReturn | null | undefined,
  componentMap: Record<string, Component>,
): Component | null {
  if (registry) {
    const component = registry.getComponent(block);
    if (component) {
      return component;
    }
  }

  return componentMap[block.type] ?? null;
}

/**
 * Computes inline styles for a block wrapper from its styles config.
 */
export function getBlockWrapperStyle(block: Block): Record<string, string> {
  const { padding, backgroundColor } = block.styles;
  const style: Record<string, string> = {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    backgroundColor: backgroundColor || "transparent",
  };
  // borderRadius is section-specific (it lives on SectionBlock, not `styles`).
  // Mirror it into the editor box style so the canvas/preview match the
  // exported MJML, which renders it as `border-radius` on the `mj-section`.
  if (
    block.type === "section" &&
    block.borderRadius &&
    block.borderRadius > 0
  ) {
    style.borderRadius = `${block.borderRadius}px`;
  }
  return style;
}

/**
 * Outer-frame style for a section's `wrapper` — the canvas equivalent of the
 * exported `mj-wrapper` (a band with its own background + padding + radius that
 * frames the section's box). Returns `null` for non-sections and for sections
 * without a wrapper, so callers can skip the extra element entirely.
 */
export function getSectionWrapperStyle(
  block: Block,
): Record<string, string> | null {
  if (block.type !== "section" || !block.wrapper) return null;
  const w = block.wrapper;
  const style: Record<string, string> = {};
  if (w.backgroundColor) style.backgroundColor = w.backgroundColor;
  if (w.padding) {
    style.padding = `${w.padding.top}px ${w.padding.right}px ${w.padding.bottom}px ${w.padding.left}px`;
  }
  if (w.borderRadius && w.borderRadius > 0) {
    style.borderRadius = `${w.borderRadius}px`;
  }
  return style;
}
