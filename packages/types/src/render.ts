import type { CustomFont } from "./config";
import type { TemplateContent } from "./template";

/**
 * Everything a {@link RenderProvider} needs to render a template, handed over as
 * one object so the editor's obligations are stated rather than implied.
 *
 * The editor guarantees the payload is **render-complete**: whatever a backend
 * cannot know by itself has already been resolved into it.
 */
export interface RenderPayload {
  /**
   * The template to render, with every custom block's `renderedHtml` already
   * filled in.
   *
   * This is the part a server genuinely cannot do: a custom block's HTML comes
   * from the consumer's liquid template plus the block's field values, and the
   * template registration lives in the browser. A renderer that receives a
   * custom block with neither a resolver nor `renderedHtml` omits it silently,
   * so pre-rendering is a contract obligation, not an optimisation.
   *
   * A defensive copy — mutating it does not touch what the user is editing.
   */
  content: TemplateContent;
  /**
   * The fonts the editor is actually rendering with: the custom faces it
   * resolved, plus the fallback stack to use for anything unmatched.
   *
   * Optional on the type so a headless caller can omit it; the editor always
   * sends it, because a font list assembled from `init({ fonts })` is not
   * something a backend can reconstruct from `content` alone.
   */
  fonts?: {
    customFonts: CustomFont[];
    defaultFallback: string;
  };
}

/**
 * Rendering backend — how a template becomes MJML, and how MJML becomes the HTML
 * that gets sent.
 *
 * Deliberately separate from `TemplatesProvider`: saving and rendering run
 * at different frequencies (autosave would compile MJML on every debounce tick),
 * fail in different ways, and are wanted by different callers. Rendering is never
 * a field on a save result.
 *
 * Pass an implementation as `render` to `init()` or `initCloud()`. **Every method
 * is independently optional**, and each one the editor resolves on its own:
 *
 * | Call | Order |
 * |---|---|
 * | `editor.toMjml()` | {@link toMjml} → the local `@templatical/renderer` → throw |
 * | `editor.toHtml()` | {@link toHtml} → `toMjml()`'s result + {@link compileMjml} → throw |
 *
 * **There is no local HTML path, ever.** The SDK does not bundle an MJML
 * compiler, so `toHtml()` without either `toHtml` or `compileMjml` rejects with
 * an explanatory error rather than guessing.
 *
 * ```ts
 * // The cheapest useful implementation: one dumb mjml2html endpoint, and the
 * // editor gains `toHtml()` while still rendering MJML locally.
 * const editor = await init({
 *   container,
 *   render: {
 *     compileMjml: (mjml) =>
 *       fetch("/api/mjml", { method: "POST", body: mjml }).then((r) => r.text()),
 *   },
 * });
 *
 * const html = await editor.toHtml();
 * ```
 */
export interface RenderProvider {
  /**
   * Render the template to MJML source. Wins over the bundled renderer — a
   * backend can render block types or refinements the browser cannot (a
   * server-generated countdown GIF, a composited video thumbnail), so its output
   * is treated as authoritative.
   */
  toMjml?(payload: RenderPayload): Promise<string>;
  /**
   * Render the template straight to sending-ready HTML, skipping the MJML round
   * trip. Implement this when your backend already owns the whole pipeline.
   */
  toHtml?(payload: RenderPayload): Promise<string>;
  /**
   * Compile MJML to HTML. A dumb `mjml2html` endpoint — it needs no knowledge of
   * the block model, which is exactly the point: MJML compilation is a commodity
   * (an off-the-shelf service, a container, a CLI shell-out), whereas rendering
   * Templatical JSON is not.
   *
   * This is the cheap tier, and the reason the interface has three methods
   * instead of two: without it, every non-Node backend that wants HTML would have
   * to stand up a Node sidecar first.
   */
  compileMjml?(mjml: string): Promise<string>;
}
