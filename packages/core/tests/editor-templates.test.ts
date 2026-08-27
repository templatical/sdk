import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from '@templatical/types';
import type {
  Template,
  TemplateContent,
  TemplatesProvider,
} from '@templatical/types';
import { useEditor } from '../src';

function contentWithOneBlock(text = 'Hello'): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ content: `<p>${text}</p>` })];
  return content;
}

function storedTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl_1',
    name: 'Welcome',
    content: contentWithOneBlock('stored'),
    ...overrides,
  };
}

/**
 * Minimal stub of the public provider contract. Every method is a vi.fn so tests
 * can assert the exact arguments `useEditor` forwards.
 */
function createMockProvider(
  overrides: Partial<TemplatesProvider> = {},
): TemplatesProvider {
  return {
    load: vi.fn().mockResolvedValue(storedTemplate()),
    create: vi.fn().mockResolvedValue(storedTemplate()),
    save: vi.fn().mockResolvedValue(storedTemplate()),
    ...overrides,
  };
}

describe('useEditor — templates provider', () => {
  it('starts with no template and neither flag set', () => {
    const editor = useEditor({ content: contentWithOneBlock() });

    expect(editor.state.template).toBeNull();
    expect(editor.state.isSaving).toBe(false);
    expect(editor.state.isLoading).toBe(false);
    expect(editor.hasTemplate()).toBe(false);
  });

  describe('without a provider', () => {
    it('rejects create() with an actionable message', async () => {
      const editor = useEditor({ content: contentWithOneBlock() });

      await expect(editor.create()).rejects.toThrow(
        /create\(\) needs a templates provider/,
      );
      expect(editor.state.template).toBeNull();
    });

    it('rejects load() with an actionable message', async () => {
      const editor = useEditor({ content: contentWithOneBlock() });

      await expect(editor.load('tpl_1')).rejects.toThrow(
        /load\(\) needs a templates provider/,
      );
    });

    it('rejects save() with an actionable message', async () => {
      const editor = useEditor({ content: contentWithOneBlock() });

      await expect(editor.save()).rejects.toThrow(
        /save\(\) needs a templates provider/,
      );
    });

    it('names the config key so the message says what to do', async () => {
      const editor = useEditor({ content: contentWithOneBlock() });

      await expect(editor.save()).rejects.toThrow(/init\(\{ templates \}\)/);
    });

    it('leaves setName() a no-op', () => {
      const editor = useEditor({ content: contentWithOneBlock() });

      editor.setName('Anything');

      expect(editor.state.template).toBeNull();
      expect(editor.state.isDirty).toBe(false);
    });
  });

  describe('create', () => {
    it('sends the current content and adopts the returned template', async () => {
      const provider = createMockProvider();
      const content = contentWithOneBlock('draft');
      const editor = useEditor({ content, templates: provider });
      editor.markDirty();

      const template = await editor.create();

      expect(provider.create).toHaveBeenCalledWith({
        content: editor.state.content,
      });
      expect(template.id).toBe('tpl_1');
      expect(editor.state.template?.id).toBe('tpl_1');
      expect(editor.hasTemplate()).toBe(true);
      expect(editor.state.isDirty).toBe(false);
      expect(editor.state.isLoading).toBe(false);
    });

    it('includes a name when one is given, and omits the key otherwise', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });

      await editor.create({ name: 'Launch' });
      expect(vi.mocked(provider.create as (i: unknown) => Promise<Template>).mock
        .calls[0][0]).toEqual({
        name: 'Launch',
        content: editor.state.content,
      });

      await editor.create();
      expect(
        Object.keys(
          vi.mocked(provider.create as (i: unknown) => Promise<Template>).mock
            .calls[1][0] as object,
        ),
      ).toEqual(['content']);
    });

    it('replaces the editor content when the input carries some', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock('before'),
        templates: provider,
      });

      await editor.create({ content: contentWithOneBlock('after') });

      expect(editor.state.content.blocks[0]).toMatchObject({
        type: 'paragraph',
        content: '<p>after</p>',
      });
    });

    it('rejects when the provider disabled create', async () => {
      const provider = createMockProvider({ create: false });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });

      await expect(editor.create()).rejects.toThrow(
        '[Templatical] Templates: create() is disabled by the provider — its `create` is `false`.',
      );
      expect(editor.state.template).toBeNull();
    });

    it('reports a failure to onError, re-throws, and leaves state untouched', async () => {
      const onError = vi.fn();
      const failure = new Error('quota exceeded');
      const provider = createMockProvider({
        create: vi.fn().mockRejectedValue(failure),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
        onError,
      });
      editor.markDirty();

      await expect(editor.create()).rejects.toThrow('quota exceeded');

      expect(onError).toHaveBeenCalledWith(failure);
      expect(editor.state.template).toBeNull();
      expect(editor.state.isDirty).toBe(true);
      expect(editor.state.isLoading).toBe(false);
    });

    it('flags isLoading for the duration of the call', async () => {
      let seen = false;
      const provider = createMockProvider({
        create: vi.fn().mockImplementation(async () => {
          seen = editor.state.isLoading;
          return storedTemplate();
        }),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });

      await editor.create();

      expect(seen).toBe(true);
      expect(editor.state.isLoading).toBe(false);
    });
  });

  describe('load', () => {
    it('adopts the stored content and clears the dirty flag', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock('local'),
        templates: provider,
      });
      editor.markDirty();

      const template = await editor.load('tpl_1');

      expect(provider.load).toHaveBeenCalledWith('tpl_1');
      expect(template.name).toBe('Welcome');
      expect(editor.state.content.blocks[0]).toMatchObject({
        content: '<p>stored</p>',
      });
      expect(editor.state.template?.name).toBe('Welcome');
      expect(editor.state.isDirty).toBe(false);
    });

    it('reports a failure to onError, re-throws, and keeps the local content', async () => {
      const onError = vi.fn();
      const failure = new Error('404');
      const provider = createMockProvider({
        load: vi.fn().mockRejectedValue(failure),
      });
      const editor = useEditor({
        content: contentWithOneBlock('local'),
        templates: provider,
        onError,
      });

      await expect(editor.load('missing')).rejects.toThrow('404');

      expect(onError).toHaveBeenCalledWith(failure);
      expect(editor.state.template).toBeNull();
      expect(editor.state.content.blocks[0]).toMatchObject({
        content: '<p>local</p>',
      });
      expect(editor.state.isLoading).toBe(false);
    });
  });

  describe('save', () => {
    it('sends name + content as one patch and clears the dirty flag', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');
      editor.markDirty();

      const template = await editor.save();

      expect(provider.save).toHaveBeenCalledWith('tpl_1', {
        name: 'Welcome',
        content: editor.state.content,
      });
      expect(template.id).toBe('tpl_1');
      expect(editor.state.isDirty).toBe(false);
      expect(editor.state.isSaving).toBe(false);
    });

    it('omits the name key when the template has none', async () => {
      const unnamed = storedTemplate({ name: undefined });
      const provider = createMockProvider({
        load: vi.fn().mockResolvedValue(unnamed),
        save: vi.fn().mockResolvedValue(unnamed),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      await editor.save();

      const patch = vi.mocked(
        provider.save as (id: string, p: unknown) => Promise<Template>,
      ).mock.calls[0][1] as object;
      expect(Object.keys(patch)).toEqual(['content']);
    });

    it('rejects when no template has been created or loaded', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });

      await expect(editor.save()).rejects.toThrow(/has no template loaded/);
      expect(provider.save).not.toHaveBeenCalled();
    });

    it('names the provider key, never an unreachable capability flag', async () => {
      // `EditorCapabilities` is exported type-only and CAPABILITIES_KEY is not
      // exported at all, so neither a core nor an editor consumer can read one.
      // An earlier message told callers to "Check `capabilities.templates.canCreate`",
      // which no consumer could act on.
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: createMockProvider({ create: false, save: false }),
      });

      const createError = await editor.create().catch((e: Error) => e);
      const saveError = await editor.save().catch((e: Error) => e);

      for (const error of [createError, saveError]) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).not.toContain('capabilities');
      }
      expect((createError as Error).message).toContain('its `create` is `false`');
    });

    it('rejects when the provider disabled save', async () => {
      const provider = createMockProvider({ save: false });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      await expect(editor.save()).rejects.toThrow(
        '[Templatical] Templates: save() is disabled by the provider — its `save` is `false`.',
      );
    });

    it('checks the disabled save before the missing template', async () => {
      // Order matters for the message the caller sees: "saving is off" is the
      // permanent condition, "nothing loaded yet" is the transient one.
      const provider = createMockProvider({ save: false });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });

      await expect(editor.save()).rejects.toThrow(/disabled by the provider/);
    });

    it('reports a failure to onError, re-throws, and keeps the dirty flag set', async () => {
      const onError = vi.fn();
      const failure = new Error('network down');
      const provider = createMockProvider({
        save: vi.fn().mockRejectedValue(failure),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
        onError,
      });
      const loaded = await editor.load('tpl_1');
      editor.markDirty();

      await expect(editor.save()).rejects.toThrow('network down');

      expect(onError).toHaveBeenCalledWith(failure);
      expect(editor.state.isDirty).toBe(true);
      expect(editor.state.isSaving).toBe(false);
      expect(editor.state.template).toEqual(loaded);
    });

    it('flags isSaving for the duration of the call', async () => {
      let seen = false;
      const provider = createMockProvider({
        save: vi.fn().mockImplementation(async () => {
          seen = editor.state.isSaving;
          return storedTemplate();
        }),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      await editor.save();

      expect(seen).toBe(true);
      expect(editor.state.isSaving).toBe(false);
    });

    it('keeps the dirty flag when an edit lands while the save is in flight', async () => {
      // Clearing it here would claim the mid-flight edit was persisted — and
      // because autosave decides dirtiness at debounce time, it would then skip
      // the follow-up save entirely (the #522 failure shape).
      let release: (t: Template) => void = () => {};
      const provider = createMockProvider({
        save: vi.fn().mockImplementation(
          () =>
            new Promise<Template>((resolve) => {
              release = resolve;
            }),
        ),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      const pending = editor.save();
      editor.updateSettings({ width: 700 });
      release(storedTemplate());
      await pending;

      expect(editor.state.isDirty).toBe(true);
    });
  });

  describe('setName', () => {
    it('renames locally, marks dirty, and travels on the next save patch', async () => {
      const provider = createMockProvider();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      editor.setName('Renamed');

      expect(editor.state.template?.name).toBe('Renamed');
      expect(editor.state.isDirty).toBe(true);

      await editor.save();

      expect(provider.save).toHaveBeenCalledWith('tpl_1', {
        name: 'Renamed',
        content: editor.state.content,
      });
    });

    it('names a template that had none', async () => {
      const provider = createMockProvider({
        load: vi.fn().mockResolvedValue(storedTemplate({ name: undefined })),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');
      expect(editor.state.template?.name).toBeUndefined();

      editor.setName('First name');

      expect(editor.state.template?.name).toBe('First name');
    });

    it('keeps a rename that lands while a save is in flight', async () => {
      // The patch is built before the await, so the provider's response carries
      // the pre-rename name. Taking it verbatim reverts what the user typed —
      // and since the next save reads the name back off `state.template`, it
      // would then persist the stale one, losing the rename outright.
      let release: () => void = () => {};
      const provider = createMockProvider({
        save: vi
          .fn()
          .mockImplementation(
            (_id: string, patch: { name?: string }) =>
              new Promise<Template>((resolve) => {
                release = () =>
                  resolve(storedTemplate({ name: patch.name }));
              }),
          ),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      const pending = editor.save();
      editor.setName('User typed this');
      release();
      await pending;

      expect(editor.state.template?.name).toBe('User typed this');
      // Still unsaved: the rename was never sent, so a follow-up save must run.
      expect(editor.state.isDirty).toBe(true);
    });

    it('discards a save response for a template that was replaced mid-flight', async () => {
      let release: () => void = () => {};
      const provider = createMockProvider({
        save: vi.fn().mockImplementation(
          () =>
            new Promise<Template>((resolve) => {
              release = () => resolve(storedTemplate({ name: 'Stale' }));
            }),
        ),
        load: vi
          .fn()
          .mockResolvedValueOnce(storedTemplate())
          .mockResolvedValueOnce(
            storedTemplate({ id: 'tpl_2', name: 'Other' }),
          ),
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
      });
      await editor.load('tpl_1');

      const pending = editor.save();
      await editor.load('tpl_2');
      release();
      await pending;

      expect(editor.state.template?.id).toBe('tpl_2');
      expect(editor.state.template?.name).toBe('Other');
    });
  });

  describe('onSaved', () => {
    it('fires once with the stored template and the trigger', async () => {
      const onSaved = vi.fn();
      // One `stored` object, asserted by identity. `storedTemplate()` mints a
      // fresh block id per call (`createParagraphBlock` → `generateId()`), so
      // comparing two independent calls with `toEqual` can never match.
      const stored = storedTemplate();
      const provider = createMockProvider({
        onSaved,
        save: vi.fn().mockResolvedValue(stored),
      });
      const editor = useEditor({ content: contentWithOneBlock(), templates: provider });

      await editor.load('tpl_1');
      await editor.save('manual');

      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onSaved.mock.calls[0][0]).toBe(stored);
      expect(onSaved.mock.calls[0][1]).toEqual({ trigger: 'manual' });
    });

    it('defaults the trigger to api for a bare core caller', async () => {
      const onSaved = vi.fn();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: createMockProvider({ onSaved }),
      });

      await editor.load('tpl_1');
      await editor.save();

      expect(onSaved.mock.calls[0][1]).toEqual({ trigger: 'api' });
    });

    it('has settled the editor before the handler runs', async () => {
      // The whole reason this is an event and not the provider body: a handler
      // that navigates must not observe the editor mid-save, or the consumer's
      // own dirty guard blocks their own navigation.
      const seen: { isDirty: boolean; isSaving: boolean; id?: string }[] = [];
      const provider = createMockProvider({
        onSaved: () => {
          seen.push({
            isDirty: editor.state.isDirty,
            isSaving: editor.state.isSaving,
            id: editor.state.template?.id,
          });
        },
      });
      const editor = useEditor({ content: contentWithOneBlock(), templates: provider });

      await editor.load('tpl_1');
      await editor.save('manual');

      expect(seen).toEqual([{ isDirty: false, isSaving: false, id: 'tpl_1' }]);
    });

    it('does not fire when the provider rejects', async () => {
      const onSaved = vi.fn();
      const provider = createMockProvider({
        onSaved,
        save: vi.fn().mockRejectedValue(new Error('nope')),
      });
      const editor = useEditor({ content: contentWithOneBlock(), templates: provider });

      await editor.load('tpl_1');
      await expect(editor.save('manual')).rejects.toThrow('nope');

      expect(onSaved).not.toHaveBeenCalled();
    });

    it('keeps the save successful when the handler throws, and reports to onError', async () => {
      const onError = vi.fn();
      const stored = storedTemplate();
      const provider = createMockProvider({
        save: vi.fn().mockResolvedValue(stored),
        onSaved: () => {
          throw new Error('handler blew up');
        },
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
        onError,
      });

      await editor.load('tpl_1');
      await expect(editor.save('manual')).resolves.toBe(stored);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe('handler blew up');
      expect(editor.state.isDirty).toBe(false);
    });

    it('wraps a non-Error throw so onError still sees a message', async () => {
      const onError = vi.fn();
      const stored = storedTemplate();
      const provider = createMockProvider({
        save: vi.fn().mockResolvedValue(stored),
        onSaved: () => {
          throw 'boom';
        },
      });
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: provider,
        onError,
      });

      await editor.load('tpl_1');
      await expect(editor.save('manual')).resolves.toBe(stored);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toBe('boom');
    });
  });

  describe('onCreated and onLoaded', () => {
    it('fires onLoaded once, after the content is on the canvas', async () => {
      const seen: { id?: string; firstBlockText: string; isLoading: boolean }[] = [];
      const provider = createMockProvider({
        onLoaded: () => {
          seen.push({
            id: editor.state.template?.id,
            firstBlockText: JSON.stringify(editor.state.content.blocks[0]),
            isLoading: editor.state.isLoading,
          });
        },
      });
      const editor = useEditor({ content: contentWithOneBlock(), templates: provider });

      await editor.load('tpl_1');

      expect(seen).toHaveLength(1);
      expect(seen[0].id).toBe('tpl_1');
      expect(seen[0].isLoading).toBe(false);
      expect(seen[0].firstBlockText).toContain('stored');
    });

    it('fires onCreated once, after the editor has settled', async () => {
      // Captures `isLoading` as well as the id. The id alone would pass with the
      // emit back inside the `try` — `state.template` is assigned there — so it
      // cannot catch a re-inlined return. `isLoading` is cleared in the
      // `finally`, so only it pins the emit below the whole construct.
      const seen: { id?: string; isLoading: boolean }[] = [];
      const provider = createMockProvider({
        onCreated: () =>
          seen.push({
            id: editor.state.template?.id,
            isLoading: editor.state.isLoading,
          }),
      });
      const editor = useEditor({ content: contentWithOneBlock(), templates: provider });

      await editor.create({ name: 'Fresh' });

      expect(seen).toEqual([{ id: 'tpl_1', isLoading: false }]);
      expect(editor.state.isDirty).toBe(false);
    });

    it('fires neither when the provider rejects', async () => {
      const onCreated = vi.fn();
      const onLoaded = vi.fn();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: createMockProvider({
          onCreated,
          onLoaded,
          create: vi.fn().mockRejectedValue(new Error('no create')),
          load: vi.fn().mockRejectedValue(new Error('no load')),
        }),
      });

      await expect(editor.create()).rejects.toThrow('no create');
      await expect(editor.load('tpl_1')).rejects.toThrow('no load');

      expect(onCreated).not.toHaveBeenCalled();
      expect(onLoaded).not.toHaveBeenCalled();
    });

    it('keeps load successful when the handler throws', async () => {
      const onError = vi.fn();
      // Identity again — see the note in the onSaved group. `storedTemplate()`
      // is not stable across calls.
      const stored = storedTemplate();
      const editor = useEditor({
        content: contentWithOneBlock(),
        templates: createMockProvider({
          load: vi.fn().mockResolvedValue(stored),
          onLoaded: () => {
            throw new Error('bad handler');
          },
        }),
        onError,
      });

      await expect(editor.load('tpl_1')).resolves.toBe(stored);
      expect(onError.mock.calls[0][0].message).toBe('bad handler');
    });
  });
});
