// @vitest-environment happy-dom
import './dom-stubs';
import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import SavedBlockPreviewCanvas from '../src/components/SavedBlockPreviewCanvas.vue';
import { mountEditor } from './helpers/mount';
import { EDITOR_KEY } from '../src/keys';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from '@templatical/types';
import type { TemplateSettings } from '@templatical/types';

/**
 * The preview must apply the same document-level style the canvas does.
 * Without it the font falls back to the editor UI's and the link rules in
 * `styles/index.css` hit their unset defaults — so a paragraph with a link
 * rendered in a saved-block preview lost its underline and serif face while
 * the identical block on the canvas kept both.
 */
function mountCanvas(settings?: Partial<TemplateSettings>) {
  const content = createDefaultTemplateContent();
  content.settings = { ...content.settings, ...settings };
  content.blocks = [createParagraphBlock({ content: '<p><a href="#">x</a></p>' })];

  return mountEditor(SavedBlockPreviewCanvas, {
    props: { blocks: content.blocks },
    provides: settings
      ? { [EDITOR_KEY]: { content: ref(content), state: {} } }
      : {},
  } as never);
}

function rootStyle(wrapper: ReturnType<typeof mountCanvas>): string {
  return wrapper.find('div').attributes('style') ?? '';
}

describe('SavedBlockPreviewCanvas document style', () => {
  it('applies the template font family', async () => {
    const wrapper = mountCanvas({ fontFamily: 'Georgia, serif' });
    await nextTick();

    expect(rootStyle(wrapper)).toContain('Georgia, serif');
  });

  it('applies the link underline variable so preview links match the canvas', async () => {
    const wrapper = mountCanvas({ linkUnderline: true });
    await nextTick();

    expect(rootStyle(wrapper)).toContain('--tpl-doc-link-underline: underline');
  });

  it('omits the underline variable when the template disables it', async () => {
    const wrapper = mountCanvas({ linkUnderline: false });
    await nextTick();

    const style = rootStyle(wrapper);
    expect(style).not.toContain('--tpl-doc-link-underline');
    // Positive control: the element IS styled, so the negative can't pass on an
    // empty style attribute.
    expect(style).toContain('background-color');
  });

  it('applies the link colour variable', async () => {
    const wrapper = mountCanvas({ linkColor: '#c0392b' });
    await nextTick();

    expect(rootStyle(wrapper)).toContain('--tpl-doc-link-color: #c0392b');
  });

  it('keeps its own background and shadow alongside the document style', async () => {
    const wrapper = mountCanvas({ fontFamily: 'Georgia, serif' });
    await nextTick();

    const style = rootStyle(wrapper);
    expect(style).toContain('var(--tpl-canvas-bg)');
    expect(style).toContain('var(--tpl-shadow-sm)');
  });

  it('renders without an editor in context', async () => {
    // The inject is optional; a headless mount must still paint the frame
    // rather than throw on a missing provider.
    const wrapper = mountCanvas();
    await nextTick();

    const style = rootStyle(wrapper);
    expect(style).toContain('var(--tpl-canvas-bg)');
    expect(style).not.toContain('--tpl-doc-link-color');
  });
});
