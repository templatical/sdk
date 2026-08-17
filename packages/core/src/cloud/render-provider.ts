import type {
  RenderPayload,
  RenderProvider,
  Template,
} from "@templatical/types";
import type { AuthManager } from "./auth";
import { useExport, type ExportFontsPayload } from "./export";

export interface CreateCloudRenderProviderOptions {
  authManager: AuthManager;
  /** The loaded template's id, or `null` before one exists. */
  getTemplateId: () => string | null;
  /** Persist the canvas so the endpoint renders what the user is looking at. */
  save: () => Promise<Template>;
}

/**
 * Templatical Cloud's renderer, shaped as a {@link RenderProvider} so it plugs
 * into the same editor seam a consumer's own backend would.
 *
 * **Why Cloud renders server-side at all**, rather than running the bundled
 * renderer like an OSS consumer: its output is a deliberate *superset* that a
 * browser cannot produce. A countdown block resolves to a URL serving a live,
 * on-demand animated GIF; a video block gets a composited play button. Both are
 * injected into the published renderer through `blockRenderers` in Cloud's Node
 * sidecar, so the delta is two functions and parity on the other twelve block
 * types holds by construction.
 *
 * Two consequences of the endpoint rendering the **stored** template:
 *
 * - **Every render saves first.** The same trade the test-email adapter makes, for
 *   the same reason: exporting a stale version of what is on screen is worse than
 *   a write the caller did not ask for. It also means `toMjml()` needs a template
 *   to exist — a Cloud session that never created one gets a clear rejection
 *   rather than an export of nothing.
 * - **`payload.content` is ignored**, along with the custom-block `renderedHtml`
 *   the editor pre-rendered into it. Cloud's `save()` persists that same content
 *   immediately before, so the server reads it from storage rather than trusting an
 *   echo. `payload.fonts` *is* read, because it is the only place the editor's
 *   effective font set is expressed. Don't "fix" the content branch.
 *
 * `compileMjml` is deliberately absent: `toMjml` and `toHtml` are both whole-
 * pipeline calls here, so there is no MJML the editor would hand back for
 * compiling.
 */
export function createCloudRenderProvider(
  options: CreateCloudRenderProviderOptions,
): RenderProvider {
  const exporter = useExport({ authManager: options.authManager });

  // Every plan renders the fonts the canvas is using: an entitlement on editor
  // capability that OSS gives away free would make the paid tier render *less*
  // than the free one.
  function exportFonts(payload: RenderPayload): ExportFontsPayload {
    return {
      customFonts: payload.fonts?.customFonts ?? [],
      defaultFallback: payload.fonts?.defaultFallback ?? "Arial, sans-serif",
    };
  }

  async function saveThenResolveId(): Promise<string> {
    if (options.getTemplateId() === null) {
      throw new Error(
        "[Templatical] Cloud renders from the saved template, so one must exist first. Call create() or load() before toMjml() / toHtml().",
      );
    }

    // Save before exporting: the endpoint reads storage, so skipping this would
    // render whatever was persisted last rather than what is on the canvas.
    const template = await options.save();
    return template.id;
  }

  return {
    async toMjml(payload: RenderPayload): Promise<string> {
      const fonts = exportFonts(payload);
      const templateId = await saveThenResolveId();
      return exporter.getMjmlSource(templateId, fonts);
    },

    async toHtml(payload: RenderPayload): Promise<string> {
      const fonts = exportFonts(payload);
      const templateId = await saveThenResolveId();
      const { html } = await exporter.exportHtml(templateId, fonts);
      return html;
    },
  };
}
