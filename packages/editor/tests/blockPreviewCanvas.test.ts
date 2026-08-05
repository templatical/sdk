// @vitest-environment happy-dom
import './dom-stubs';
import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import BlockPreviewCanvas from '../src/components/BlockPreviewCanvas.vue';
import { mountEditor } from './helpers/mount';
import { EMAIL_FRAME_WIDTH_TRANSITION } from '../src/utils/emailFrameWidth';
import { CONDITION_PREVIEW_KEY, EDITOR_KEY } from '../src/keys';
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

  return mountEditor(BlockPreviewCanvas, {
    props: { blocks: content.blocks },
    provides: settings
      ? { [EDITOR_KEY]: { content: ref(content), state: {} } }
      : {},
  } as never);
}

function rootStyle(wrapper: ReturnType<typeof mountCanvas>): string {
  return wrapper.find('div').attributes('style') ?? '';
}

describe('BlockPreviewCanvas document style', () => {
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

/**
 * Condition awareness and viewport, added so the test-email dialog's pre-send
 * preview is truthful. Both default to the previous behaviour, so the
 * saved-blocks surfaces — which have no viewport control and preview *stored*
 * blocks whose ids aren't in the current template — are unaffected.
 *
 * The stakes are asymmetric: a preview shown immediately before sending that
 * includes condition-excluded content is worse than no preview at all, because
 * the user trusts it.
 */
describe('BlockPreviewCanvas visibility and viewport', () => {
  /**
   * `hideExcluded` rather than an id list: the blocks are created inside, so a
   * caller can't name an id before the call that makes it.
   */
  function mountWith(opts: {
    hideExcluded?: boolean;
    viewport?: 'desktop' | 'mobile';
    applyConditionFilter?: boolean;
  }) {
    const kept = createParagraphBlock({ content: '<p>kept</p>' });
    const excluded = createParagraphBlock({ content: '<p>excluded</p>' });
    const hidden = new Set(opts.hideExcluded ? [excluded.id] : []);

    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: {
        blocks: [kept, excluded],
        ...(opts.viewport ? { viewport: opts.viewport } : {}),
        ...(opts.applyConditionFilter === undefined
          ? {}
          : { applyConditionFilter: opts.applyConditionFilter }),
      },
      provides: {
        [CONDITION_PREVIEW_KEY]: {
          isHidden: (id: string) => hidden.has(id),
        },
      },
    } as never);

    return { wrapper, kept, excluded };
  }

  it('renders every block when nothing is condition-hidden', () => {
    const { wrapper } = mountWith({});

    expect(wrapper.text()).toContain('kept');
    expect(wrapper.text()).toContain('excluded');
  });

  it('omits a block a display condition excludes', () => {
    const { wrapper } = mountWith({ hideExcluded: true });

    expect(wrapper.text()).toContain('kept');
    // Omitted from the DOM, not merely hidden — the preview must not carry
    // content the recipient will never receive.
    expect(wrapper.text()).not.toContain('excluded');
  });

  it('keeps a condition-hidden block when the filter does not apply', () => {
    // A resolver owns the preview: it already evaluated every condition against
    // real data, so a hand-toggled hide must not veto its answer.
    const { wrapper } = mountWith({
      hideExcluded: true,
      applyConditionFilter: false,
    });

    expect(wrapper.text()).toContain('kept');
    expect(wrapper.text()).toContain('excluded');
  });

  it('applies the filter by default, so saved-blocks surfaces are unchanged', () => {
    // The prop's default is the positive control for the case above: if it ever
    // flipped to false, the assertion above would pass for the wrong reason.
    const { wrapper } = mountWith({ hideExcluded: true });

    expect(wrapper.text()).not.toContain('excluded');
  });

  it('renders everything when no conditionPreview is provided', () => {
    // The saved-blocks browser has no condition tracking for stored ids; absence
    // must mean "show it", never "hide it".
    const kept = createParagraphBlock({ content: '<p>kept</p>' });
    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: { blocks: [kept] },
    } as never);

    expect(wrapper.text()).toContain('kept');
  });

  it('frames at the desktop email width by default', () => {
    const { wrapper } = mountWith({});

    expect(wrapper.find('div').attributes('style')).toContain('width: 600px');
  });

  it('narrows to the mobile width when asked', () => {
    const { wrapper } = mountWith({ viewport: 'mobile' });

    // Matches Canvas.vue's mobile breakpoint, so the two agree.
    expect(wrapper.find('div').attributes('style')).toContain('width: 375px');
  });

  it('eases the width change with the editor’s viewport transition', () => {
    // Switching viewport here should feel identical to the canvas's own toggle,
    // so the frame animates with the same shared curve rather than snapping.
    const { wrapper } = mountWith({});

    expect(wrapper.find('div').attributes('style')).toContain(
      EMAIL_FRAME_WIDTH_TRANSITION,
    );
  });
});
