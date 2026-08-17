import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from '@templatical/types';
import type {
  CustomBlock,
  RenderPayload,
  RenderProvider,
  TemplateContent,
} from '@templatical/types';
import {
  buildRenderPayload,
  createRenderMethods,
  resolveRenderFonts,
} from '../src/utils/renderProvider';

/** A minimal registered-definition-shaped custom block, by `customType`. */
function makeCustomBlock(type: string): CustomBlock {
  return createCustomBlock({ type, name: type, template: '', fields: [] });
}

/**
 * `editor.toMjml()` / `editor.toHtml()` resolve **per method, not per provider** —
 * a provider that implements one of the three methods is not thereby claiming the
 * others. Each row of the two resolution ladders is pinned below, in both
 * directions, so a change that collapses them into one provider-level check fails.
 */

const CUSTOM_FONT = { name: 'Custom', url: 'https://fonts.com/custom.css' };

function makeContent(blocks: TemplateContent['blocks'] = []): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

function fontsSource() {
  return {
    customFonts: { value: [CUSTOM_FONT] },
    defaultFallback: { value: 'Georgia, serif' },
  };
}

function methods(
  provider: RenderProvider | null,
  overrides: {
    payload?: RenderPayload;
    renderLocalMjml?: () => Promise<string>;
  } = {},
) {
  const payload = overrides.payload ?? { content: makeContent() };
  const buildPayload = vi.fn().mockResolvedValue(payload);
  const renderLocalMjml =
    overrides.renderLocalMjml ?? vi.fn().mockResolvedValue('<mjml>local</mjml>');

  return {
    ...createRenderMethods({ provider, buildPayload, renderLocalMjml }),
    buildPayload,
    renderLocalMjml,
    payload,
  };
}

describe('toMjml resolution', () => {
  it('uses the provider when it implements toMjml', async () => {
    const toMjml = vi.fn().mockResolvedValue('<mjml>provider</mjml>');
    const m = methods({ toMjml });

    await expect(m.toMjml()).resolves.toBe('<mjml>provider</mjml>');
    expect(m.renderLocalMjml).not.toHaveBeenCalled();
  });

  it('hands the provider the built payload', async () => {
    const toMjml = vi.fn().mockResolvedValue('<mjml/>');
    const payload: RenderPayload = {
      content: makeContent(),
      fonts: { customFonts: [CUSTOM_FONT], defaultFallback: 'Georgia, serif' },
    };
    const m = methods({ toMjml }, { payload });

    await m.toMjml();

    expect(toMjml).toHaveBeenCalledWith(payload);
  });

  it('falls back to the bundled renderer when the provider omits toMjml', async () => {
    const m = methods({ compileMjml: vi.fn() });

    await expect(m.toMjml()).resolves.toBe('<mjml>local</mjml>');
    expect(m.renderLocalMjml).toHaveBeenCalledTimes(1);
    // No provider method is reached, so no payload is assembled either.
    expect(m.buildPayload).not.toHaveBeenCalled();
  });

  it('falls back to the bundled renderer with no provider at all', async () => {
    const m = methods(null);
    await expect(m.toMjml()).resolves.toBe('<mjml>local</mjml>');
  });

  it("propagates the bundled renderer's missing-package error", async () => {
    const m = methods(null, {
      renderLocalMjml: vi
        .fn()
        .mockRejectedValue(
          new Error(
            '[Templatical] toMjml() requires the @templatical/renderer package. Please install it.',
          ),
        ),
    });

    await expect(m.toMjml()).rejects.toThrow('requires the @templatical/renderer');
  });

  it('propagates a provider rejection rather than silently falling back', async () => {
    const m = methods({
      toMjml: vi.fn().mockRejectedValue(new Error('backend down')),
    });

    await expect(m.toMjml()).rejects.toThrow('backend down');
    expect(m.renderLocalMjml).not.toHaveBeenCalled();
  });
});

describe('toHtml resolution', () => {
  it('uses the provider when it implements toHtml', async () => {
    const toHtml = vi.fn().mockResolvedValue('<html>provider</html>');
    const compileMjml = vi.fn();
    const m = methods({ toHtml, compileMjml });

    await expect(m.toHtml()).resolves.toBe('<html>provider</html>');
    expect(compileMjml).not.toHaveBeenCalled();
    expect(m.renderLocalMjml).not.toHaveBeenCalled();
  });

  it('compiles locally-rendered MJML when the provider only has compileMjml', async () => {
    const compileMjml = vi.fn().mockResolvedValue('<html>compiled</html>');
    const m = methods({ compileMjml });

    await expect(m.toHtml()).resolves.toBe('<html>compiled</html>');
    expect(m.renderLocalMjml).toHaveBeenCalledTimes(1);
    expect(compileMjml).toHaveBeenCalledWith('<mjml>local</mjml>');
  });

  // The provider's MJML is authoritative — it can render block types the browser
  // cannot — so `toHtml()` composes through `toMjml()` rather than forcing the
  // local renderer. A `provider.toMjml` + `compileMjml` pair with no `toHtml` must
  // not have its own MJML bypassed on the way to HTML.
  it('compiles the provider MJML when it supplies toMjml + compileMjml but no toHtml', async () => {
    const toMjml = vi.fn().mockResolvedValue('<mjml>provider</mjml>');
    const compileMjml = vi.fn().mockResolvedValue('<html>from provider mjml</html>');
    const m = methods({ toMjml, compileMjml });

    await expect(m.toHtml()).resolves.toBe('<html>from provider mjml</html>');
    expect(compileMjml).toHaveBeenCalledWith('<mjml>provider</mjml>');
    expect(m.renderLocalMjml).not.toHaveBeenCalled();
  });

  it('rejects with instructions when the provider has neither toHtml nor compileMjml', async () => {
    const m = methods({ toMjml: vi.fn().mockResolvedValue('<mjml/>') });

    await expect(m.toHtml()).rejects.toThrow(
      'toHtml() requires a `render` provider implementing either `toHtml` or `compileMjml`',
    );
  });

  it('rejects with the same error when no provider is configured', async () => {
    const m = methods(null);

    // There is no local HTML path, ever — the SDK bundles no MJML compiler.
    await expect(m.toHtml()).rejects.toThrow('there is no local HTML path');
    expect(m.renderLocalMjml).not.toHaveBeenCalled();
  });

  it('propagates a compileMjml rejection', async () => {
    const m = methods({
      compileMjml: vi.fn().mockRejectedValue(new Error('mjml service 503')),
    });

    await expect(m.toHtml()).rejects.toThrow('mjml service 503');
  });

  it('builds the payload at most once per call', async () => {
    const m = methods({
      toMjml: vi.fn().mockResolvedValue('<mjml/>'),
      compileMjml: vi.fn().mockResolvedValue('<html/>'),
    });

    await m.toHtml();

    expect(m.buildPayload).toHaveBeenCalledTimes(1);
  });
});

describe('resolveRenderFonts', () => {
  it('reports the configured custom fonts and fallback', () => {
    expect(resolveRenderFonts(fontsSource())).toEqual({
      customFonts: [CUSTOM_FONT],
      defaultFallback: 'Georgia, serif',
    });
  });

  it('reports an empty list when nothing is configured', () => {
    // There is no enablement flag to read: nothing can withdraw custom faces
    // mid-session, so the canvas's font set and the payload's are the same set by
    // construction.
    expect(
      resolveRenderFonts({
        customFonts: { value: [] },
        defaultFallback: { value: 'Georgia, serif' },
      }),
    ).toEqual({ customFonts: [], defaultFallback: 'Georgia, serif' });
  });
});

describe('buildRenderPayload', () => {
  let renderCustomBlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renderCustomBlock = vi
      .fn()
      .mockImplementation(async (block: CustomBlock) => `<p>${block.customType}</p>`);
  });

  function source(content: TemplateContent) {
    return {
      getContent: () => content,
      renderCustomBlock: renderCustomBlock as (
        block: CustomBlock,
      ) => Promise<string>,
      getFonts: () => resolveRenderFonts(fontsSource()),
    };
  }

  it('pre-renders every top-level custom block into renderedHtml', async () => {
    const custom = makeCustomBlock('qrcode');
    const payload = await buildRenderPayload(source(makeContent([custom])));

    const rendered = payload.content.blocks[0] as CustomBlock;
    expect(rendered.renderedHtml).toBe('<p>qrcode</p>');
  });

  it('pre-renders custom blocks nested inside section columns', async () => {
    const custom = makeCustomBlock('banner');
    const section = createSectionBlock({ columns: '1', children: [[custom]] });
    const payload = await buildRenderPayload(source(makeContent([section])));

    const column = (payload.content.blocks[0] as { children: CustomBlock[][] })
      .children[0];
    expect(column[0].renderedHtml).toBe('<p>banner</p>');
  });

  it('leaves the live content untouched — a render must not mutate the document', async () => {
    const custom = makeCustomBlock('qrcode');
    const content = makeContent([custom]);

    await buildRenderPayload(source(content));

    expect((content.blocks[0] as CustomBlock).renderedHtml).toBeUndefined();
  });

  it('hands back a defensive copy, not the editor content by reference', async () => {
    const content = makeContent([createParagraphBlock({ content: '<p>hi</p>' })]);
    const payload = await buildRenderPayload(source(content));

    expect(payload.content).not.toBe(content);
    expect(payload.content).toEqual(content);
  });

  it('degrades a failing custom block to a comment rather than dropping it', async () => {
    renderCustomBlock.mockRejectedValue(new Error('liquid blew up'));
    const custom = makeCustomBlock('qrcode');
    const payload = await buildRenderPayload(source(makeContent([custom])));

    expect((payload.content.blocks[0] as CustomBlock).renderedHtml).toBe(
      '<!-- Custom block render error: qrcode -->',
    );
  });

  it('attaches the resolved fonts', async () => {
    const payload = await buildRenderPayload(source(makeContent()));

    expect(payload.fonts).toEqual({
      customFonts: [CUSTOM_FONT],
      defaultFallback: 'Georgia, serif',
    });
  });

  it('does no custom-block work when the template has none', async () => {
    await buildRenderPayload(
      source(makeContent([createParagraphBlock({ content: '<p>hi</p>' })])),
    );

    expect(renderCustomBlock).not.toHaveBeenCalled();
  });
});
