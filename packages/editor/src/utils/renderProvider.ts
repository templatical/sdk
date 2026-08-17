import type {
  CustomBlock,
  CustomFont,
  RenderPayload,
  RenderProvider,
  TemplateContent,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import { preRenderCustomBlocks } from "./preRenderCustomBlocks";

/** The fonts half of a {@link RenderPayload}, as the editor resolves it. */
export interface RenderFonts {
  customFonts: CustomFont[];
  defaultFallback: string;
}

/** Minimal slice of the fonts manager the payload needs. */
export interface RenderFontsSource {
  customFonts: { value: CustomFont[] };
  defaultFallback: { value: string };
}

/**
 * The fonts the editor is *actually* rendering with.
 *
 * The canvas's font set and the payload's are the same set *by construction*
 * rather than by agreement: nothing can switch custom faces off for a plan, so
 * there is no second source of truth to keep in step.
 */
export function resolveRenderFonts(source: RenderFontsSource): RenderFonts {
  return {
    customFonts: source.customFonts.value,
    defaultFallback: source.defaultFallback.value,
  };
}

/** What {@link buildRenderPayload} needs from an editor instance. */
export interface RenderPayloadSource {
  getContent: () => TemplateContent;
  renderCustomBlock: (block: CustomBlock) => Promise<string>;
  getFonts: () => RenderFonts;
}

/**
 * Assemble the render-complete payload a {@link RenderProvider} is promised.
 *
 * "Render-complete" is the deal that lets the provider win over the bundled
 * renderer: local rendering sees custom blocks and fonts natively, a backend
 * doesn't, so the editor resolves both up front instead of each backend
 * rediscovering the problem.
 *
 * The content is a **defensive copy** (`safeClone`, same as `getContent()`, since
 * a drag inside a section can leave a Sortable expando cycle reachable from live
 * content). Pre-rendering writes `renderedHtml` onto blocks, and doing that to the
 * live tree would mark the editor dirty and make an export mutate the document.
 */
export async function buildRenderPayload(
  source: RenderPayloadSource,
): Promise<RenderPayload> {
  const content = safeClone(source.getContent());
  await preRenderCustomBlocks(content, {
    renderCustomBlock: source.renderCustomBlock,
  });

  return { content, fonts: source.getFonts() };
}

/** What {@link createRenderMethods} needs to resolve each method. */
export interface RenderMethodsSource {
  /** The consumer's backend, when `render` was configured. */
  provider?: RenderProvider | null;
  buildPayload: () => Promise<RenderPayload>;
  /**
   * Render MJML with the bundled `@templatical/renderer`. Expected to reject with
   * the "install @templatical/renderer" error when the optional peer is absent —
   * that rejection *is* the `toMjml()` chain's final `throw`.
   */
  renderLocalMjml: () => Promise<string>;
}

export interface RenderMethods {
  toMjml(): Promise<string>;
  toHtml(): Promise<string>;
}

/**
 * `editor.toMjml()` / `editor.toHtml()`, resolved **per method rather than per
 * provider** — a provider that implements one of the three methods is not thereby
 * claiming the others.
 *
 * | Call | Order |
 * |---|---|
 * | `toMjml()` | `provider.toMjml` → the bundled renderer → throw |
 * | `toHtml()` | `provider.toHtml` → `toMjml()` + `provider.compileMjml` → throw |
 *
 * `toHtml()` composes through `toMjml()` rather than forcing the local renderer,
 * so a provider whose MJML is authoritative (Cloud's is — it renders block types
 * a browser cannot) is not silently bypassed on the way to HTML. When the provider
 * only supplies `compileMjml`, that resolves to local MJML anyway, which is the
 * cheap tier working exactly as intended.
 *
 * **There is no local HTML path, ever.** The SDK deliberately does not bundle an
 * MJML compiler, so the last step is a rejection with instructions rather than a
 * guess.
 */
export function createRenderMethods(
  source: RenderMethodsSource,
): RenderMethods {
  async function toMjml(): Promise<string> {
    const provider = source.provider;
    // Bound rather than narrowed in place: the call sits behind an `await`, and a
    // bound reference cannot be re-read as undefined afterwards.
    const providerToMjml = provider?.toMjml?.bind(provider);
    if (providerToMjml) {
      return providerToMjml(await source.buildPayload());
    }
    return source.renderLocalMjml();
  }

  async function toHtml(): Promise<string> {
    const provider = source.provider;

    const providerToHtml = provider?.toHtml?.bind(provider);
    if (providerToHtml) {
      return providerToHtml(await source.buildPayload());
    }

    const compileMjml = provider?.compileMjml?.bind(provider);
    if (compileMjml) {
      return compileMjml(await toMjml());
    }

    throw new Error(
      "[Templatical] toHtml() requires a `render` provider implementing either " +
        "`toHtml` or `compileMjml`. The SDK does not bundle an MJML compiler, so " +
        "there is no local HTML path — point `compileMjml` at any mjml2html " +
        "endpoint (a hosted service, a container, or a CLI shell-out).",
    );
  }

  return { toMjml, toHtml };
}
