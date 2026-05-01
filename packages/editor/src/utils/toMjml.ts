import type { CustomBlock, TemplateContent } from "@templatical/types";

/**
 * Minimal slice of the editor surface needed by `toMjmlForInstance`.
 * Decoupled from the full `TemplaticalEditor` type so this helper can be
 * tested in isolation with a stub object.
 */
export interface ToMjmlSource {
  getContent(): TemplateContent;
  renderCustomBlock(block: CustomBlock): Promise<string>;
}

/**
 * Lazy-load `@templatical/renderer` and render the editor's current content
 * to MJML, wiring the editor's own custom block resolver into the renderer's
 * `renderCustomBlock` callback.
 *
 * The renderer is an optional peer dependency (small, MIT-licensed). It is
 * only loaded when an export is actually requested. Consumers that don't
 * need MJML export at all (e.g., embedding the editor in an app where the
 * backend handles export) can omit the install entirely; calling `toMjml()`
 * in that case throws a clear error naming the missing package.
 *
 * The dynamic import is cached by the module system, so subsequent calls
 * skip the import overhead.
 */
export async function toMjmlForInstance(
  instance: ToMjmlSource,
): Promise<string> {
  let renderer: typeof import("@templatical/renderer");
  try {
    renderer = await import("@templatical/renderer");
  } catch {
    throw new Error(
      "[Templatical] toMjml() requires the @templatical/renderer package. Please install it.",
    );
  }
  return renderer.renderToMjml(instance.getContent(), {
    renderCustomBlock: instance.renderCustomBlock,
  });
}
