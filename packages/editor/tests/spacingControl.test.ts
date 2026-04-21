// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import SpacingControl from '../src/components/SpacingControl.vue';
import { mountEditor } from './helpers/mount';

type Spacing = { top: number; right: number; bottom: number; left: number };

const uniform = (v: number): Spacing => ({ top: v, right: v, bottom: v, left: v });

function mountIt(modelValue: Spacing) {
  return mountEditor(SpacingControl, {
    props: { modelValue, label: 'Padding' },
  });
}

describe('SpacingControl', () => {
  it('starts locked when initial value is uniform (all sides equal)', () => {
    const wrapper = mountIt(uniform(8));
    expect(
      wrapper.find('button[aria-label="spacingControl.unlock"]').exists(),
    ).toBe(true);
  });

  it('starts unlocked when initial value is non-uniform', () => {
    const wrapper = mountIt({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(
      wrapper.find('button[aria-label="spacingControl.lockAll"]').exists(),
    ).toBe(true);
  });

  it('emits uniform update when locked and a stepper is pressed', async () => {
    const wrapper = mountIt(uniform(5));
    const increaseTop = wrapper.find(
      'button[aria-label="spacingControl.increaseTop"]',
    );
    await increaseTop.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted![0]).toEqual([{ top: 6, right: 6, bottom: 6, left: 6 }]);
  });

  it('emits only the changed side when unlocked', async () => {
    const wrapper = mountIt({ top: 0, right: 10, bottom: 0, left: 0 });
    const increaseLeft = wrapper.find(
      'button[aria-label="spacingControl.increaseLeft"]',
    );
    await increaseLeft.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted![0]).toEqual([{ top: 0, right: 10, bottom: 0, left: 1 }]);
  });

  it('clamps decrement at zero (never emits negative values)', async () => {
    const wrapper = mountIt(uniform(0));
    const decreaseTop = wrapper.find(
      'button[aria-label="spacingControl.decreaseTop"]',
    );
    await decreaseTop.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted![0]).toEqual([{ top: 0, right: 0, bottom: 0, left: 0 }]);
  });

  it('typing a value in the input emits the clamped value', async () => {
    const wrapper = mountIt({ top: 5, right: 5, bottom: 5, left: 5 });
    const topInput = wrapper.find('input[aria-label="spacingControl.top"]');
    (topInput.element as HTMLInputElement).value = '-3';
    await topInput.trigger('input');

    const emitted = wrapper.emitted('update:modelValue');
    // locked mode + negative input → clamped to 0 and propagated to all sides
    expect(emitted![0]).toEqual([{ top: 0, right: 0, bottom: 0, left: 0 }]);
  });

  it('toggles lock and emits uniform value based on top when locking', async () => {
    const wrapper = mountIt({ top: 7, right: 2, bottom: 3, left: 4 });
    const lockButton = wrapper.find(
      'button[aria-label="spacingControl.lockAll"]',
    );
    await lockButton.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted![0]).toEqual([{ top: 7, right: 7, bottom: 7, left: 7 }]);
  });
});
