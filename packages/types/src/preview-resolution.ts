import type { TemplateContent } from "./template";

/**
 * Context handed to `resolvePreview`.
 *
 * `recipient` is present only on surfaces that have one — the test-email
 * dialog — and absent in the editor's own preview mode. Treat its absence as
 * "no particular recipient", not as an error: a resolver should still return
 * something renderable, typically its own default or sample data.
 */
export interface PreviewResolveContext {
  /**
   * The template as it currently stands. Already a copy — mutating it has no
   * effect on the editor, and returning it unchanged is a valid no-op.
   */
  content: TemplateContent;
  /** The address the preview is being shown for, when the surface has one. */
  recipient?: string;
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
