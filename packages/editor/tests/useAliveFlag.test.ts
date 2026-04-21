// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useAliveFlag, type AliveFlag } from '../src/composables/useAliveFlag';

function mountWithFlag() {
  let captured!: AliveFlag;
  const wrapper = mount(
    defineComponent({
      setup() {
        captured = useAliveFlag();
        return () => h('div');
      },
    }),
  );
  return { wrapper, flag: () => captured };
}

describe('useAliveFlag', () => {
  it('alive is true after setup', () => {
    const { flag } = mountWithFlag();
    expect(flag().alive).toBe(true);
  });

  it('alive flips to false on unmount', () => {
    const { wrapper, flag } = mountWithFlag();
    expect(flag().alive).toBe(true);
    wrapper.unmount();
    expect(flag().alive).toBe(false);
  });

  it('separate instances have isolated state', () => {
    const a = mountWithFlag();
    const b = mountWithFlag();
    a.wrapper.unmount();
    expect(a.flag().alive).toBe(false);
    expect(b.flag().alive).toBe(true);
    b.wrapper.unmount();
    expect(b.flag().alive).toBe(false);
  });
});
