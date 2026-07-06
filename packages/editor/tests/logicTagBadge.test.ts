// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { SYNTAX_PRESETS } from '@templatical/types';
import LogicTagBadge from '../src/components/LogicTagBadge.vue';

const liquid = SYNTAX_PRESETS.liquid;

describe('LogicTagBadge', () => {
  it('renders the uppercase keyword for a logic value', () => {
    const wrapper = mount(LogicTagBadge, {
      props: { value: '{% if vip %}', syntax: liquid },
    });
    const badge = wrapper.find('[data-testid="merge-tag-logic-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('IF');
    expect(badge.attributes('data-logic-keyword')).toBe('IF');
  });

  it('renders nothing for a data value', () => {
    const wrapper = mount(LogicTagBadge, {
      props: { value: '{{first_name}}', syntax: liquid },
    });
    expect(wrapper.find('[data-testid="merge-tag-logic-badge"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toBe('');
  });

  it('derives ENDIF for a closing logic tag', () => {
    const wrapper = mount(LogicTagBadge, {
      props: { value: '{% endif %}', syntax: liquid },
    });
    expect(
      wrapper.find('[data-testid="merge-tag-logic-badge"]').text(),
    ).toBe('ENDIF');
  });

  it('supports handlebars logic tags', () => {
    const wrapper = mount(LogicTagBadge, {
      props: { value: '{{#each items}}', syntax: SYNTAX_PRESETS.handlebars },
    });
    const badge = wrapper.find('[data-testid="merge-tag-logic-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('EACH');
  });
});
