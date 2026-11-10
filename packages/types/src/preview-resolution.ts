import type { TemplateContent } from "./template";

/** Why `resolvePreview` was called. */
export type PreviewResolveTrigger = "open" | "refresh" | "recipient" | "locale";

/** Which preview is calling `resolvePreview`. */
export type PreviewSurface = "preview" | "test-email";

/**
 * Context handed to `resolvePreview`.
 *
 * `surface` tells the editor's own preview mode and the test-email dialog
 * apart; the presence of `recipient` does not. `recipient` is absent in preview
 * mode, and also in the test-email dialog while its recipient field is empty.
 * Treat its absence as "no particular recipient", not as an error: a resolver
 * should still return something renderable, its own default or sample data,
 * or obtain a recipient itself, for example by awaiting its own picker on
 * `surface: "preview"` with `trigger: "open"` or `"refresh"` (see
 * guide/preview-rendering).
 */
export interface PreviewResolveContext {
  /**
   * The template as it currently stands. Already a copy — mutating it has no
   * effect on the editor, and returning it unchanged is a valid no-op.
   */
  content: TemplateContent;
  /**
   * The address the preview is being shown for. Only the test-email dialog
   * sets it, and only while its recipient field holds an address.
   */
  recipient?: string;
  /**
   * Which preview is calling, on every call including a refresh:
   * - "preview": the editor's own preview mode;
   * - "test-email": the test-email dialog's preview.
   */
  surface: PreviewSurface;
  /**
   * Why this call happened:
   * - "open": a preview surface opened (editor preview mode, or the test-email dialog);
   * - "refresh": the user clicked Refresh preview, or the host called `refreshPreview()`;
   * - "recipient": the test-email recipient changed;
   * - "locale": the template language changed while a preview was open.
   */
  trigger: PreviewResolveTrigger;
}

/**
 * Resolves a template for display on preview surfaces — typically substituting
 * merge tags and **evaluating logic tags** against real data.
 *
 * Logic tags are the reason this hook exists. `MergeTag.sample` already covers
 * value tags client-side, but branching (`{% if %}` … `{% endif %}`) cannot be
 * evaluated in a browser for every supported syntax — mailchimp and ampscript
 * logic are server-side dialects — so only the consumer's own backend can do it.
 *
 * Display-only. The returned content reaches preview surfaces and nothing else:
 * it is never written to the editor's state, never returned from
 * `getContent()`, never sent, and never exported. Rejecting is safe — the
 * preview falls back to the unresolved template and says so.
 */
export type ResolvePreview = (
  context: PreviewResolveContext,
) => Promise<TemplateContent>;

/**
 * Whether `value` is shaped enough like `TemplateContent` to render.
 *
 * A resolver is consumer code returning data that often came from an HTTP
 * response, so the declared return type guarantees nothing at runtime. A
 * mis-shaped result is treated as a resolution failure — the preview degrades
 * to the unresolved template — rather than throwing inside the render.
 */
export function isRenderableTemplateContent(
  value: unknown,
): value is TemplateContent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { blocks?: unknown };
  return Array.isArray(candidate.blocks);
}
