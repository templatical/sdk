// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { MergeTag } from '@templatical/types';
import MergeTagSuggestionList from '../src/components/MergeTagSuggestionList.vue';

const tags: MergeTag[] = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Last Name', value: '{{last_name}}' },
  { label: 'Email', value: '{{email}}' },
];

describe('MergeTagSuggestionList', () => {
  it('renders one button per item', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    expect(wrapper.findAll('button')).toHaveLength(3);
  });

  it('exposes data-merge-tag-value per item', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('data-merge-tag-value')).toBe(
      '{{first_name}}',
    );
    expect(buttons[2].attributes('data-merge-tag-value')).toBe('{{email}}');
  });

  it('marks the selected item via data-selected="true"', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 1, emptyText: 'none' },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('data-selected')).toBe('false');
    expect(buttons[1].attributes('data-selected')).toBe('true');
    expect(buttons[2].attributes('data-selected')).toBe('false');
  });

  it('renders empty state when items array is empty', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: [], selectedIndex: 0, emptyText: 'No matching tags' },
    });
    const empty = wrapper.find('[data-testid="merge-tag-suggestion-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toBe('No matching tags');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('mousedown on an item does NOT propagate to document — guards against editor teardown', async () => {
    // Regression for the real bug: clicking a suggestion item synchronously
    // runs the suggestion command, which detaches the clicked button from
    // the DOM (the popup unmounts). If the mousedown bubbles to the
    // document, useRichTextEditor.handleClickOutside sees a detached
    // event.target — closest('.tpl-text-editor-wrapper') returns null on
    // a detached node — the click-outside guard fails, and onDone() tears
    // down the inline text editor right after the merge tag was inserted.
    //
    // The fix: stop propagation at the popup item so document listeners
    // never see the event. This test reproduces that exact path.
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
      attachTo: document.body,
    });

    const docMousedown = vi.fn();
    document.addEventListener('mousedown', docMousedown);

    try {
      const button = wrapper.findAll('button')[0];
      button.element.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      );

      const selectEmitted = wrapper.emitted('select');
      expect(selectEmitted).toBeDefined();
      expect(selectEmitted?.[0]?.[0]).toEqual(tags[0]);
      expect(docMousedown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('mousedown', docMousedown);
      wrapper.unmount();
    }
  });

  it('emits select with item on mousedown', async () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    await wrapper.findAll('button')[1].trigger('mousedown');
    const emitted = wrapper.emitted('select');
    expect(emitted).toBeDefined();
    expect(emitted?.[0]?.[0]).toEqual(tags[1]);
  });

  it('emits hover with index on mousemove over a non-selected option', async () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    // mousemove (not mouseenter) — mouseenter also fires when an option
    // moves under a stationary cursor, which spuriously shifts selection
    // when the popup repositions to track scroll.
    await wrapper.findAll('button')[2].trigger('mousemove');
    const emitted = wrapper.emitted('hover');
    expect(emitted?.[0]?.[0]).toBe(2);
  });

  it('does not emit hover for the already-selected option', async () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    await wrapper.findAll('button')[0].trigger('mousemove');
    expect(wrapper.emitted('hover')).toBeUndefined();
  });

  it('renders both label and value text', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: [tags[0]], selectedIndex: 0, emptyText: 'none' },
    });
    const html = wrapper.text();
    expect(html).toContain('First Name');
    expect(html).toContain('{{first_name}}');
  });

  it('uses role="listbox" + role="option"', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 0, emptyText: 'none' },
    });
    expect(wrapper.attributes('role')).toBe('listbox');
    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(3);
  });

  it('listbox accepts a listId prop and uses it as id (for aria-controls wiring)', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: {
        items: tags,
        selectedIndex: 0,
        emptyText: 'none',
        listId: 'mt-listbox-42',
      },
    });
    expect(wrapper.attributes('id')).toBe('mt-listbox-42');
  });

  it('each option has a stable id derived from listId (for aria-activedescendant)', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: {
        items: tags,
        selectedIndex: 0,
        emptyText: 'none',
        listId: 'mt-listbox-7',
      },
    });
    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(3);
    options.forEach((opt, i) => {
      const id = opt.attributes('id');
      expect(id).toBe(`mt-listbox-7-opt-${i}`);
    });
  });

  it('aria-selected reflects selectedIndex', () => {
    const wrapper = mount(MergeTagSuggestionList, {
      props: { items: tags, selectedIndex: 2, emptyText: 'none' },
    });
    const options = wrapper.findAll('[role="option"]');
    expect(options[2].attributes('aria-selected')).toBe('true');
    expect(options[0].attributes('aria-selected')).toBe('false');
  });
});
