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
function mountCanvas(
  settings?: Partial<TemplateSettings>,
  props: { embedded?: boolean } = {},
) {
  const content = createDefaultTemplateContent();
  content.settings = { ...content.settings, ...settings };
  content.blocks = [createParagraphBlock({ content: '<p><a href="#">x</a></p>' })];

  return mountEditor(BlockPreviewCanvas, {
    props: { blocks: content.blocks, ...props },
    provides: settings
      ? { [EDITOR_KEY]: { content: ref(content), state: {} } }
      : {},
  } as never);
}

/**
 * Style of the content column — the element whose width IS the email width.
 * Queried by testid rather than `find('div')`, which now reaches the stage
 * wrapper: the stage carries `min-width: 600px`, so a substring assertion for
 * `width: 600px` against it passes no matter what the column is doing.
 */
function columnStyle(wrapper: { find: (s: string) => { attributes: (a: string) => string | undefined } }): string {
  return (
    wrapper.find('[data-testid="block-preview-canvas"]').attributes('style') ??
    ''
  );
}

/** Style of the stage — the band of email background around the column. */
function stageStyle(wrapper: { find: (s: string) => { attributes: (a: string) => string | undefined } }): string {
  return (
    wrapper.find('[data-testid="block-preview-stage"]').attributes('style') ??
    ''
  );
}

function rootStyle(wrapper: ReturnType<typeof mountCanvas>): string {
  return columnStyle(wrapper);
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
    expect(style).toContain('font-family');
  });

  it('applies the link colour variable', async () => {
    const wrapper = mountCanvas({ linkColor: '#c0392b' });
    await nextTick();

    expect(rootStyle(wrapper)).toContain('--tpl-doc-link-color: #c0392b');
  });

  it('keeps the card shadow on the stage alongside the document style', async () => {
    const wrapper = mountCanvas({ fontFamily: 'Georgia, serif' });
    await nextTick();

    expect(stageStyle(wrapper)).toContain('var(--tpl-shadow-sm)');
    expect(rootStyle(wrapper)).toContain('Georgia, serif');
  });

  it('renders without an editor in context', async () => {
    // The inject is optional; a headless mount must still paint the frame
    // rather than throw on a missing provider.
    const wrapper = mountCanvas();
    await nextTick();

    expect(stageStyle(wrapper)).toContain('var(--tpl-canvas-bg)');
    expect(rootStyle(wrapper)).not.toContain('--tpl-doc-link-color');
  });
});

/**
 * The email's body background — `mj-body background-color` when sent. It lives
 * on the stage, not in `getDocumentStyle`: the canvas applies that helper to
 * `.tpl-canvas`, which has to stay transparent so the invertible background
 * layer beneath it shows through, and a background there would double-paint and
 * defeat the dark-mode preview.
 *
 * Before this, every preview surface painted the editor's neutral
 * `--tpl-canvas-bg` regardless of the template, so a coloured body read as
 * unset in the dialog shown immediately before sending (#598).
 */
describe('BlockPreviewCanvas email background', () => {
  it('paints the stage with the template background', async () => {
    const wrapper = mountCanvas({ backgroundColor: '#1c25ff' });
    await nextTick();

    expect(stageStyle(wrapper)).toContain('background-color: #1c25ff');
  });

  it('leaves the content column transparent so the stage shows through', async () => {
    // A block without its own background must reveal the body colour, which is
    // the whole reported symptom: the band behind a bare button block.
    const wrapper = mountCanvas({ backgroundColor: '#1c25ff' });
    await nextTick();

    expect(rootStyle(wrapper)).not.toContain('background-color');
  });

  it('falls back to the neutral surface when the background is cleared', async () => {
    // The colour pickers clear to an empty string to mean "unset". Emitted as
    // an inline style that renders the frame transparent, so the fallback has
    // to be truthiness, not `??`.
    const wrapper = mountCanvas({ backgroundColor: '' });
    await nextTick();

    expect(stageStyle(wrapper)).toContain('var(--tpl-canvas-bg)');
  });

  it('gives the stage a full gutter on each side, capped by its container', async () => {
    const wrapper = mountCanvas({ backgroundColor: '#1c25ff' });
    await nextTick();

    const style = stageStyle(wrapper);
    // 600 + 96 * 2 — the same band Canvas.vue puts around its content column.
    expect(style).toContain('width: 792px');
    // `max-width: 100%` is what lets a dialog with less room show a narrower
    // band instead of overflowing; `min-width` stops it squeezing the column.
    expect(style).toContain('max-width: 100%');
    expect(style).toContain('min-width: 600px');
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
/**
 * `embedded` is for callers that already sit inside an email frame — the canvas
 * rendering `footerBlocks`. Keeping the standalone frame there draws a second
 * card inside the email rather than a continuation of it.
 */
describe('BlockPreviewCanvas embedded', () => {
  it('drops the stage but keeps the document style', () => {
    const wrapper = mountCanvas({ fontFamily: 'Georgia, serif' }, { embedded: true });
    const stage = wrapper.find('[data-testid="block-preview-stage"]');
    const column = wrapper.find('[data-testid="block-preview-canvas"]');

    expect(stage.attributes('style')).toBeUndefined();
    expect(stage.classes()).not.toContain('tpl:rounded-lg');
    // The column fills the caller rather than setting the email width itself.
    expect(column.attributes('style') ?? '').not.toContain('width:');
    // Same font and link rules as the blocks it sits under.
    expect(column.attributes('style') ?? '').toContain('Georgia, serif');
  });

  it('keeps the stage by default, so existing callers are untouched', () => {
    const wrapper = mountCanvas({ fontFamily: 'Georgia, serif' });
    const stage = wrapper.find('[data-testid="block-preview-stage"]');

    expect(stage.attributes('style') ?? '').toContain('box-shadow');
    expect(
      wrapper.find('[data-testid="block-preview-canvas"]').attributes('style') ?? '',
    ).toContain('width: 600px');
  });
});

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

    expect(columnStyle(wrapper)).toContain('width: 600px');
  });

  it('narrows to the mobile width when asked', () => {
    const { wrapper } = mountWith({ viewport: 'mobile' });

    // Matches Canvas.vue's mobile breakpoint, so the two agree.
    expect(columnStyle(wrapper)).toContain('width: 375px');
    // The gutter travels with it, so a mobile preview keeps the same band the
    // canvas shows in mobile rather than losing the body colour on the switch.
    expect(stageStyle(wrapper)).toContain('width: 567px');
  });

  it('eases the width change with the editor’s viewport transition', () => {
    // Switching viewport here should feel identical to the canvas's own toggle,
    // so the frame animates with the same shared curve rather than snapping.
    const { wrapper } = mountWith({});

    expect(columnStyle(wrapper)).toContain(EMAIL_FRAME_WIDTH_TRANSITION);
  });
});
