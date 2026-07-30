// @vitest-environment happy-dom
import './dom-stubs';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import SavedBlockPreviewRow from '../src/components/SavedBlockPreviewRow.vue';
import { mountEditor } from './helpers/mount';
import { TRANSLATIONS_KEY } from '../src/keys';
import en from '../src/i18n/locales/en';
import { createTitleBlock } from '@templatical/types';
import type { Block } from '@templatical/types';

/**
 * The row measures real layout to decide whether a block is clipped, and
 * happy-dom reports 0 for every box. These stub the two metrics `measure()`
 * reads, so a block can be made deliberately taller or shorter than the
 * collapsed cap (240px at the scale below).
 */
const PREVIEW_WIDTH = 600;

function stubMetrics(contentHeight: number, frameWidth = PREVIEW_WIDTH): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return frameWidth;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return contentHeight;
    },
  });
}

afterEach(() => {
  // Leave the prototype as found — these getters are global.
  for (const prop of ['clientWidth', 'offsetHeight']) {
    Reflect.deleteProperty(HTMLElement.prototype, prop);
  }
});

function mountRow(block: Block = createTitleBlock()) {
  return mountEditor(SavedBlockPreviewRow, {
    props: { block, position: 1, total: 2 },
    attachTo: document.body,
    // Real strings: the toggle's aria-label is interpolated through `format()`,
    // which the key-path stub proxy swallows.
    provides: { [TRANSLATIONS_KEY]: en },
    global: { stubs: { BlockPreviewCanvas: true } },
  } as never);
}

describe('SavedBlockPreviewRow clipping', () => {
  const FADE = '[data-testid="saved-blocks-preview-fade"]';
  const TOGGLE = '[data-testid="saved-blocks-preview-toggle"]';

  it('leaves a short block unclipped — no fade, no toggle', async () => {
    stubMetrics(120);
    const wrapper = mountRow();
    await nextTick();

    expect(wrapper.find(FADE).exists()).toBe(false);
    expect(wrapper.find(TOGGLE).exists()).toBe(false);
    // Sized to the block itself, not to the cap.
    expect(wrapper.find('[data-testid="saved-blocks-reorder-row"] > div > div')
      .attributes('style')).toContain('height: 120px');
  });

  it('collapses a tall block to the cap and fades the cut', async () => {
    stubMetrics(900);
    const wrapper = mountRow();
    await nextTick();

    expect(wrapper.find(FADE).exists()).toBe(true);
    expect(wrapper.find(TOGGLE).exists()).toBe(true);
    const frame = wrapper.find(
      '[data-testid="saved-blocks-reorder-row"] > div > div',
    );
    expect(frame.attributes('style')).toContain('height: 240px');
  });

  it('expands to the full height and drops the fade', async () => {
    stubMetrics(900);
    const wrapper = mountRow();
    await nextTick();

    await wrapper.find(TOGGLE).trigger('click');
    await nextTick();

    const frame = wrapper.find(
      '[data-testid="saved-blocks-reorder-row"] > div > div',
    );
    expect(frame.attributes('style')).toContain('height: 900px');
    // Nothing is hidden any more, so the affordance for it goes away.
    expect(wrapper.find(FADE).exists()).toBe(false);
    // The toggle stays, now offering the way back.
    expect(wrapper.find(TOGGLE).attributes('aria-expanded')).toBe('true');
  });

  it('collapses again on a second click', async () => {
    stubMetrics(900);
    const wrapper = mountRow();
    await nextTick();

    await wrapper.find(TOGGLE).trigger('click');
    await nextTick();
    await wrapper.find(TOGGLE).trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="saved-blocks-reorder-row"] > div > div')
        .attributes('style'),
    ).toContain('height: 240px');
    expect(wrapper.find(FADE).exists()).toBe(true);
    expect(wrapper.find(TOGGLE).attributes('aria-expanded')).toBe('false');
  });

  it('names the block in the toggle label', async () => {
    stubMetrics(900);
    const wrapper = mountRow();
    await nextTick();

    expect(wrapper.find(TOGGLE).attributes('aria-label')).toBe(
      'Expand Title preview',
    );

    await wrapper.find(TOGGLE).trigger('click');
    await nextTick();

    expect(wrapper.find(TOGGLE).attributes('aria-label')).toBe(
      'Collapse Title preview',
    );
  });

  it('hides the fade from assistive tech — it is decoration', async () => {
    stubMetrics(900);
    const wrapper = mountRow();
    await nextTick();

    expect(wrapper.find(FADE).attributes('aria-hidden')).toBe('true');
    // And it must never eat a click meant for the row underneath.
    expect(wrapper.find(FADE).classes()).toContain('tpl:pointer-events-none');
  });

  it('scales down when the frame is narrower than the email width', async () => {
    // Half width → half scale, so the clip threshold is measured against the
    // *scaled* height (500 * 0.5 = 250) rather than the raw one.
    stubMetrics(500, PREVIEW_WIDTH / 2);
    const wrapper = mountRow();
    await nextTick();

    const content = wrapper.find(
      '[data-testid="saved-blocks-reorder-row"] > div > div > div',
    );
    expect(content.attributes('style')).toContain('scale(0.5)');
    // 250 > 240, so it is clipped by a hair — proving the cap sees scaled px.
    expect(wrapper.find(TOGGLE).exists()).toBe(true);
  });
});
