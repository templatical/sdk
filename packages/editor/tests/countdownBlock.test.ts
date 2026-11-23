// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createCountdownBlock } from '@templatical/types';
import CountdownBlock from '../src/components/blocks/CountdownBlock.vue';
import { mountEditor } from './helpers/mount';
import { COUNTDOWN_PROVIDER_KEY, IMAGE_URL_RESOLVER_KEY, EDITOR_KEY } from '../src/keys';
import { createImageUrlResolver } from '../src/composables/useImageUrlResolver';
import { RESOLVE_IMAGE_DEBOUNCE_MS } from '../src/constants/timeouts';
import { createDefaultTemplateContent } from '@templatical/types';
import { nextTick, ref } from 'vue';

const FUTURE_DATE = new Date(Date.now() + 2 * 86_400_000 + 3 * 3_600_000).toISOString(); // ~2d 3h ahead
const PAST_DATE = new Date(Date.now() - 60_000).toISOString();

function mount(overrides: Parameters<typeof createCountdownBlock>[0] = {}) {
  const block = createCountdownBlock({
    labelDays: 'days',
    labelHours: 'hrs',
    labelMinutes: 'min',
    labelSeconds: 'sec',
    ...overrides,
  });
  return mountEditor(CountdownBlock, {
    props: { block, viewport: 'desktop' as const },
  });
}

describe('CountdownBlock', () => {
  it('shows the resolved provider image and content-locale alt, then falls back on error', async () => {
    const block = createCountdownBlock({
      targetDate: '2026-12-24T17:00:00.000Z',
      timezone: 'Europe/Berlin',
    });
    const content = createDefaultTemplateContent();
    content.settings.locale = 'de';
    const imageUrl = (item: typeof block) =>
      `https://example.com/${encodeURIComponent(item.targetDate)}.gif`;
    const wrapper = mountEditor(CountdownBlock, {
      props: { block, viewport: 'desktop' },
      provides: {
        [COUNTDOWN_PROVIDER_KEY]: { imageUrl },
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver((src) => `${src}?preview=1`),
        [EDITOR_KEY]: { content: ref(content) },
      },
    });

    const image = wrapper.get('img');
    expect(image.attributes('src')).toBe(
      `https://example.com/${encodeURIComponent(block.targetDate)}.gif?preview=1`,
    );
    expect(image.attributes('alt')).toBe(
      'Countdown: 24. Dezember 2026 um 18:00 (Europe/Berlin)',
    );
    await image.trigger('error');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.findAll('.tpl\\:text-center > div:first-child')).toHaveLength(4);

    const nextDate = '2026-12-25T17:00:00.000Z';
    vi.useFakeTimers();
    try {
      await wrapper.setProps({ block: { ...block, targetDate: nextDate } });
      await nextTick();
      expect(wrapper.get('img').attributes('src')).toBe(
        'https://example.com/2026-12-25T17%3A00%3A00.000Z.gif',
      );

      await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS);
      await flushPromises();
      await nextTick();
      expect(wrapper.get('img').attributes('src')).toBe(
        'https://example.com/2026-12-25T17%3A00%3A00.000Z.gif?preview=1',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows setDate prompt when no targetDate is set', () => {
    const wrapper = mount({ targetDate: '' });
    expect(wrapper.text()).toContain('countdown.setDate');
  });

  it('renders four zero-padded segments for a future date with all units enabled', () => {
    const wrapper = mount({ targetDate: FUTURE_DATE });
    const digits = wrapper.findAll('.tpl\\:text-center > div:first-child');
    expect(digits).toHaveLength(4);
    for (const d of digits) {
      expect(d.text()).toMatch(/^\d{2}$/);
    }
  });

  it('days segment reflects remaining full days to targetDate', () => {
    const wrapper = mount({ targetDate: FUTURE_DATE });
    const firstDigit = wrapper.find('.tpl\\:text-center > div:first-child');
    expect(firstDigit.text()).toBe('02');
  });

  it('reads a wall-clock targetDate in the block timezone, not the process zone', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 11, 24, 12, 0));
    try {
      const wrapper = mount({
        targetDate: '2026-12-24T18:00',
        timezone: 'Europe/Berlin',
      });
      const digits = wrapper
        .findAll('.tpl\\:gap-2 .tpl\\:text-center > div:first-child')
        .map((d) => d.text());
      // 18:00 Berlin is 17:00Z, five hours after the frozen 12:00Z.
      expect(digits).toEqual(['00', '05', '00', '00']);
    } finally {
      vi.useRealTimers();
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('omits disabled units from rendered segments', () => {
    const wrapper = mount({
      targetDate: FUTURE_DATE,
      showDays: false,
      showSeconds: false,
    });
    const segments = wrapper.findAll('.tpl\\:gap-2 .tpl\\:text-center');
    expect(segments).toHaveLength(2); // hours + minutes only
  });

  it('renders separators between (but not before first) segments', () => {
    const wrapper = mount({ targetDate: FUTURE_DATE, separator: '|' });
    const html = wrapper.html();
    // 4 segments → 3 separators
    const matches = html.match(/\|/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('shows expiredMessage once targetDate has passed', () => {
    const wrapper = mount({
      targetDate: PAST_DATE,
      expiredMessage: 'Campaign closed',
      hideOnExpiry: false,
    });
    expect(wrapper.text()).toContain('Campaign closed');
    // No digit segments rendered in expired-with-message branch.
    expect(wrapper.findAll('.tpl\\:gap-2 .tpl\\:text-center')).toHaveLength(0);
  });

  it('shows hidden placeholder when expired and hideOnExpiry is true', () => {
    const wrapper = mount({
      targetDate: PAST_DATE,
      hideOnExpiry: true,
      expiredMessage: 'Should not show',
    });
    expect(wrapper.text()).not.toContain('Should not show');
    expect(wrapper.text()).toContain('countdown.hidden');
  });

  it('applies digitColor and digitFontSize to digit elements', () => {
    const wrapper = mount({
      targetDate: FUTURE_DATE,
      digitColor: '#ff0000',
      digitFontSize: 48,
    });
    const digit = wrapper.find('.tpl\\:text-center > div:first-child');
    const style = digit.attributes('style') ?? '';
    expect(style).toContain('color: #ff0000');
    expect(style).toContain('font-size: 48px');
  });

  it('applies labelColor and labelFontSize to label elements', () => {
    const wrapper = mount({
      targetDate: FUTURE_DATE,
      labelColor: '#00ff00',
      labelFontSize: 10,
    });
    const label = wrapper.find('.tpl\\:text-center > div:last-child');
    const style = label.attributes('style') ?? '';
    expect(style).toContain('color: #00ff00');
    expect(style).toContain('font-size: 10px');
  });

  it('applies backgroundColor to the container', () => {
    const wrapper = mount({
      targetDate: FUTURE_DATE,
      backgroundColor: '#123456',
    });
    const container = wrapper.find('.tpl\\:flex.tpl\\:items-center.tpl\\:justify-center.tpl\\:gap-2');
    expect(container.attributes('style')).toContain('background-color: #123456');
  });

  it('invalid targetDate renders zero-valued segments (targetTime null → zero remaining)', () => {
    const wrapper = mount({ targetDate: 'not-a-date' });
    const digits = wrapper.findAll('.tpl\\:text-center > div:first-child');
    expect(digits.map((d) => d.text())).toEqual(['00', '00', '00', '00']);
  });

  it('renders configured unit labels on each segment', () => {
    const wrapper = mount({
      targetDate: FUTURE_DATE,
      labelDays: 'D',
      labelHours: 'H',
      labelMinutes: 'M',
      labelSeconds: 'S',
    });
    const labels = wrapper
      .findAll('.tpl\\:text-center > div:last-child')
      .map((e) => e.text());
    expect(labels).toEqual(['D', 'H', 'M', 'S']);
  });
});
