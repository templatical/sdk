import { describe, expect, it, vi } from 'vitest';
import type {
  CustomBlock,
  SectionBlock,
  TemplateContent,
  TitleBlock,
} from '@templatical/types';
import { createSectionBlock, createTitleBlock } from '@templatical/types';
import { preRenderCustomBlocks } from '../src/utils/preRenderCustomBlocks';
import type { UseBlockRegistryReturn } from '../src/composables/useBlockRegistry';

function createCustom(customType: string, id = 'c1'): CustomBlock {
  return {
    id,
    type: 'custom',
    customType,
    fieldValues: {},
    styles: {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  } as CustomBlock;
}

function content(blocks: any[]): TemplateContent {
  return { blocks, settings: {} } as TemplateContent;
}

function registry(
  renderFn: UseBlockRegistryReturn['renderCustomBlock'],
): UseBlockRegistryReturn {
  return { renderCustomBlock: renderFn } as UseBlockRegistryReturn;
}

describe('preRenderCustomBlocks', () => {
  it('populates renderedHtml on top-level custom blocks', async () => {
    const custom = createCustom('banner');
    const render = vi.fn().mockResolvedValue('<div>banner html</div>');

    await preRenderCustomBlocks(content([custom]), registry(render));

    expect(custom.renderedHtml).toBe('<div>banner html</div>');
    expect(render).toHaveBeenCalledWith(custom);
  });

  it('leaves non-custom blocks untouched', async () => {
    const title = createTitleBlock() as TitleBlock;
    const render = vi.fn();

    await preRenderCustomBlocks(content([title]), registry(render));

    expect(render).not.toHaveBeenCalled();
    expect('renderedHtml' in title).toBe(false);
  });

  it('swallows per-block render errors and stores a comment placeholder', async () => {
    const custom = createCustom('broken');
    const render = vi.fn().mockRejectedValue(new Error('boom'));

    await preRenderCustomBlocks(content([custom]), registry(render));

    expect(custom.renderedHtml).toBe(
      '<!-- Custom block render error: broken -->',
    );
  });

  it('renders custom blocks nested inside section columns (recursion)', async () => {
    const nested = createCustom('nested', 'nested-1');
    const section = createSectionBlock() as SectionBlock;
    section.children = [[nested], []];
    const render = vi.fn().mockResolvedValue('<span>nested</span>');

    await preRenderCustomBlocks(content([section]), registry(render));

    expect(nested.renderedHtml).toBe('<span>nested</span>');
    expect(render).toHaveBeenCalledWith(nested);
  });

  it('continues rendering remaining blocks after one block fails', async () => {
    const good = createCustom('good', 'g1');
    const bad = createCustom('bad', 'b1');
    const render = vi
      .fn()
      .mockResolvedValueOnce('<p>good</p>')
      .mockRejectedValueOnce(new Error('fail'));

    await preRenderCustomBlocks(content([good, bad]), registry(render));

    expect(good.renderedHtml).toBe('<p>good</p>');
    expect(bad.renderedHtml).toBe('<!-- Custom block render error: bad -->');
  });

  it('handles empty content without errors', async () => {
    const render = vi.fn();
    await preRenderCustomBlocks(content([]), registry(render));
    expect(render).not.toHaveBeenCalled();
  });
});
