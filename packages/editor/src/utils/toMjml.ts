import type { CustomBlock, TemplateContent } from "@templatical/types";

/**
 * Minimal slice of the editor surface needed by `toMjmlForInstance`.
 * Decoupled from the full `TemplaticalEditor` type so this helper can be
 * tested in isolation with a stub object.
 */
export interface ToMjmlSource {
  getContent(): TemplateContent;
  renderCustomBlock(block: CustomBlock): Promise<string>;
  /**
   * Optional. Look up the definition-level CSS for a custom block type.
   * Returns `undefined` when the definition is unknown or has no
   * `stylesheet`. Wired to the renderer's `getCustomBlockStylesheet` option
   * so authored responsive/hover/font CSS lands in `<mj-head>` deduped per
   * definition. Sources that omit it produce the same MJML as before this
   * field existed — backward compatible.
   */
  getCustomBlockStylesheet?: (customType: string) => string | undefined;
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
/**
 * Resolve `@templatical/renderer`, or `null` when it isn't installed.
 *
 * The single `import("@templatical/renderer")` site in the package, so callers
 * can choose their own failure behaviour without duplicating the dynamic import
 * or matching on an error message. {@link toMjmlForInstance} throws when this
 * returns `null`; the test-email path degrades to JSON-only and warns once,
 * because there the renderer is opt-in and a missing install must not break
 * sending.
 *
 * Cheap to call repeatedly — the module system caches the import, so a second
 * call after a successful first one costs nothing.
 */
export async function tryLoadRenderer(): Promise<
  typeof import("@templatical/renderer") | null
> {
  try {
    return await import("@templatical/renderer");
  } catch {
    return null;
  }
}

export async function toMjmlForInstance(
  instance: ToMjmlSource,
): Promise<string> {
  const renderer = await tryLoadRenderer();
  if (!renderer) {
    throw new Error(
      "[Templatical] toMjml() requires the @templatical/renderer package. Please install it.",
    );
  }
  const stylesheetResolver = instance.getCustomBlockStylesheet;
  return renderer.renderToMjml(instance.getContent(), {
    renderCustomBlock: instance.renderCustomBlock,
    // Only pass through when the source actually provides a resolver, so
    // callers that don't care about stylesheets see the same options shape
    // (and the same MJML output) as before this field existed.
    ...(stylesheetResolver
      ? {
          getCustomBlockStylesheet: (customType: string) =>
            stylesheetResolver(customType),
        }
      : {}),
  });
}
