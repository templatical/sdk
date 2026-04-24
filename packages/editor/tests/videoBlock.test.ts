// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import VideoPlayButton from '../src/components/blocks/VideoPlayButton.vue';

describe('VideoPlayButton', () => {
  it('renders an SVG play triangle', () => {
    const wrapper = mount(VideoPlayButton);
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
    const polygon = svg.find('polygon');
    expect(polygon.attributes('points')).toBe('5,3 19,12 5,21');
  });

  it('does not apply the hover-transition class by default', () => {
    const wrapper = mount(VideoPlayButton);
    const outer = wrapper.find('div');
    expect(outer.classes()).not.toContain('tpl:transition-opacity');
  });

  it('applies the hover-transition class when hoverEffect=true', () => {
    const wrapper = mount(VideoPlayButton, {
      props: { hoverEffect: true },
    });
    const outer = wrapper.find('div');
    expect(outer.classes()).toContain('tpl:transition-opacity');
  });
});
