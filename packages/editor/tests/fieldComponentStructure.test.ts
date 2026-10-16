// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import type { MediaResult } from '@templatical/types';
import TextField from '../src/components/toolbar/fields/TextField.vue';
import TextareaField from '../src/components/toolbar/fields/TextareaField.vue';
import NumberField from '../src/components/toolbar/fields/NumberField.vue';
import SelectField from '../src/components/toolbar/fields/SelectField.vue';
import BooleanField from '../src/components/toolbar/fields/BooleanField.vue';
import ImageField from '../src/components/toolbar/fields/ImageField.vue';
import { mountEditor } from './helpers/mount';
import en from '../src/i18n/locales/en';
import {
  CAN_DROP_MEDIA_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from '../src/keys';

describe('TextField', () => {
  it('renders an editable MergeTagInput (not the disabled readOnly fallback)', () => {
    const wrapper = mountEditor(TextField, {
      props: {
        field: { type: 'text', key: 'name', label: 'Name' },
        modelValue: 'hello',
      },
    });
    const input = wrapper.find('input');
    expect(input.attributes('disabled')).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe('hello');
  });

  it('renders a disabled native input in readOnly mode', () => {
    const wrapper = mountEditor(TextField, {
      props: {
        field: { type: 'text', key: 'name', label: 'Name' },
        modelValue: 'locked',
        readOnly: true,
      },
    });
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('disabled')).toBeDefined();
    expect((input.element as HTMLInputElement).value).toBe('locked');
  });
});

describe('TextareaField', () => {
  it('renders a disabled textarea in readOnly mode', () => {
    const wrapper = mountEditor(TextareaField, {
      props: {
        field: { type: 'textarea', key: 'bio', label: 'Bio' },
        modelValue: 'Some text',
        readOnly: true,
      },
    });
    const ta = wrapper.find('textarea');
    expect(ta.exists()).toBe(true);
    expect(ta.attributes('disabled')).toBeDefined();
  });
});

describe('NumberField', () => {
  it('renders a number input reflecting modelValue', () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age', min: 0, max: 99, step: 1 },
        modelValue: 42,
      },
    });
    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe('42');
    expect(input.attributes('min')).toBe('0');
    expect(input.attributes('max')).toBe('99');
    expect(input.attributes('step')).toBe('1');
  });

  it('emits update:modelValue with a Number on input', async () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age' },
        modelValue: 0,
      },
    });
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = '17';
    await input.trigger('input');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([17]);
  });

  it('does not emit when readOnly and user attempts to type', async () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age' },
        modelValue: 5,
        readOnly: true,
      },
    });
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = '10';
    await input.trigger('input');

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });
});

describe('SelectField', () => {
  const field = {
    type: 'select' as const,
    key: 'size',
    label: 'Size',
    options: [
      { value: 's', label: 'Small' },
      { value: 'm', label: 'Medium' },
      { value: 'l', label: 'Large' },
    ],
  };

  it('renders an option per field.options entry', () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 'm' },
    });
    const options = wrapper.findAll('option');
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.attributes('value'))).toEqual(['s', 'm', 'l']);
  });

  it('reflects modelValue as the select value', () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 'l' },
    });
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('l');
  });

  it('emits update:modelValue on change', async () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 's' },
    });
    const select = wrapper.find('select');
    (select.element as HTMLSelectElement).value = 'l';
    await select.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toEqual([['l']]);
  });

  it('does not emit on change when readOnly', async () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 's', readOnly: true },
    });
    const select = wrapper.find('select');
    (select.element as HTMLSelectElement).value = 'l';
    await select.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });
});

describe('BooleanField', () => {
  const field = { type: 'boolean' as const, key: 'on', label: 'Active' };

  it('renders a switch button with aria-checked reflecting modelValue', () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: true },
    });
    const btn = wrapper.find('button[role="switch"]');
    expect(btn.attributes('aria-checked')).toBe('true');
  });

  it('toggles and emits inverted modelValue on click', async () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: false },
    });
    await wrapper.find('button[role="switch"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
  });

  it('is disabled and does not emit when readOnly', async () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: false, readOnly: true },
    });
    const btn = wrapper.find('button[role="switch"]');
    expect(btn.attributes('disabled')).toBeDefined();
    await btn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('renders required indicator when field.required is true', () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field: { ...field, required: true }, modelValue: false },
    });
    expect(wrapper.text()).toContain('*');
  });
});

// The zone reads the dragged type from `items` and the dropped file from
// `files`, so one shape serves every drag event.
function dragEvent(type: 'dragenter' | 'dragleave' | 'drop'): Event {
  const file = new File(['data'], 'up.png', { type: 'image/png' });
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [file], items: [{ type: file.type }] },
  });
  return event;
}

/** An `onRequestMedia` that stays pending until the test settles it. */
function pendingMedia() {
  let settle: (value: MediaResult | null) => void = () => {};
  const fn = vi.fn(
    () =>
      new Promise<MediaResult | null>((resolve) => {
        settle = resolve;
      }),
  );
  return { fn, settle: (value: MediaResult | null) => settle(value) };
}

describe('ImageField', () => {
  const imageField = { type: 'image' as const, key: 'img', label: 'Image' };

  function mountImageField(
    onRequestMedia: unknown,
    options: { readOnly?: boolean; provides?: Record<symbol, unknown> } = {},
  ) {
    return mountEditor(ImageField, {
      props: { field: imageField, modelValue: '', readOnly: options.readOnly },
      provides: {
        [TRANSLATIONS_KEY]: en,
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
        ...options.provides,
      },
    });
  }

  function browseButton(wrapper: VueWrapper) {
    return wrapper
      .findAll('button')
      .find((b) => b.text().includes(en.image.browseMedia));
  }

  // A read-only field renders a disabled input, so drags go to the zone
  // itself rather than through the input.
  function dropZone(wrapper: VueWrapper): Element {
    return wrapper.get('input[type="url"]').element.parentElement!;
  }

  it('shows the uploading state until a dropped image finishes uploading', async () => {
    let finish: (value: { url: string }) => void = () => {};
    const onRequestMedia = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = mountEditor(ImageField, {
      props: {
        field: { type: 'image', key: 'img', label: 'Image' },
        modelValue: '',
      },
      provides: {
        [TRANSLATIONS_KEY]: en,
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
      },
    });
    const file = new File(['data'], 'up.png', { type: 'image/png' });

    // The drop listener attaches once the zone's template ref resolves, a
    // tick after mount. A drop on the URL input bubbles up to the zone.
    await flushPromises();
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file], items: [{ type: file.type }] },
    });
    wrapper.get('input[type="url"]').element.dispatchEvent(event);
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ['images'],
      files: [file],
    });
    expect(wrapper.text()).toContain(en.image.uploading);

    finish({ url: 'https://cdn/up.png' });
    await flushPromises();

    expect(wrapper.text()).not.toContain(en.image.uploading);
    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['https://cdn/up.png'],
    ]);
  });

  it('sets the url from the media browser and ignores alt', async () => {
    const onRequestMedia = vi.fn(async () => ({
      url: 'https://cdn/f.png',
      alt: 'ignored',
    }));
    const wrapper = mountImageField(onRequestMedia);

    await browseButton(wrapper)!.trigger('click');
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ['images'] });
    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['https://cdn/f.png'],
    ]);
  });

  it('leaves the url alone when the media browser is cancelled', async () => {
    const onRequestMedia = vi.fn(async () => null);
    const wrapper = mountImageField(onRequestMedia);

    await browseButton(wrapper)!.trigger('click');
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('hides browse without a media handler and when read-only', () => {
    expect(browseButton(mountImageField(null))).toBeUndefined();
    expect(
      browseButton(mountImageField(vi.fn(), { readOnly: true })),
    ).toBeUndefined();
  });

  it('highlights while an image is dragged over the field', async () => {
    const wrapper = mountImageField(vi.fn());
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('dragenter'));
    await nextTick();
    expect(wrapper.text()).toContain(en.image.dropToUpload);
    expect(wrapper.get('.lucide-upload').attributes('width')).toBe('18');

    dropZone(wrapper).dispatchEvent(dragEvent('dragleave'));
    await nextTick();
    expect(wrapper.text()).not.toContain(en.image.dropToUpload);
  });

  it('leaves the url alone when the upload is cancelled', async () => {
    const media = pendingMedia();
    const wrapper = mountImageField(media.fn);
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();
    expect(wrapper.text()).toContain(en.image.uploading);

    media.settle(null);
    await flushPromises();

    expect(wrapper.text()).not.toContain(en.image.uploading);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('ignores a second drop while the first uploads', async () => {
    const media = pendingMedia();
    const wrapper = mountImageField(media.fn);
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();
    dropZone(wrapper).dispatchEvent(dragEvent('dragenter'));
    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();

    expect(media.fn).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain(en.image.dropToUpload);

    media.settle({ url: 'https://cdn/f.png' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['https://cdn/f.png'],
    ]);
  });

  it('ignores a drop when read-only', async () => {
    const onRequestMedia = vi.fn();
    const wrapper = mountImageField(onRequestMedia, { readOnly: true });
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('dragenter'));
    await nextTick();
    expect(wrapper.text()).not.toContain(en.image.dropToUpload);

    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();
    expect(onRequestMedia).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('ignores a drop when the library is read-only, but keeps browse', async () => {
    const onRequestMedia = vi.fn();
    const wrapper = mountImageField(onRequestMedia, {
      provides: { [CAN_DROP_MEDIA_KEY]: computed(() => false) },
    });
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('dragenter'));
    await nextTick();
    expect(wrapper.text()).not.toContain(en.image.dropToUpload);

    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();
    expect(onRequestMedia).not.toHaveBeenCalled();
    expect(browseButton(wrapper)).toBeDefined();
  });

  it('ignores a drop without a media handler', async () => {
    const wrapper = mountImageField(null);
    await flushPromises();

    dropZone(wrapper).dispatchEvent(dragEvent('dragenter'));
    await nextTick();
    expect(wrapper.text()).not.toContain(en.image.dropToUpload);

    dropZone(wrapper).dispatchEvent(dragEvent('drop'));
    await flushPromises();
    expect(wrapper.text()).not.toContain(en.image.uploading);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
