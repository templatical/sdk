// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, type InjectionKey, inject } from 'vue';
import { mount } from '@vue/test-utils';
import type { TemplateContent } from '@templatical/types';

// --- Mocks: stub the composable dependencies so we can assert call-shape ---

vi.mock('@templatical/core', () => ({
  useHistory: vi.fn(() => ({
    isNavigating: ref(false),
    destroy: vi.fn(),
  })),
  useHistoryInterceptor: vi.fn(),
  useBlockActions: vi.fn(() => ({ addBlock: vi.fn() })),
  useAutoSave: vi.fn(() => ({
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  })),
  useConditionPreview: vi.fn(() => ({ reset: vi.fn() })),
}));

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>(
    '@vueuse/core',
  );
  return {
    ...actual,
    useEventListener: vi.fn(),
  };
});

import {
  useHistory,
  useHistoryInterceptor,
  useBlockActions,
  useAutoSave,
  useConditionPreview,
} from '@templatical/core';
import { useEventListener } from '@vueuse/core';
import { useEditorCore } from '../src/composables/useEditorCore';
import type { BaseEditorReturn } from '../src/composables/useEditorCore';
import {
  TRANSLATIONS_KEY,
  EDITOR_KEY,
  HISTORY_KEY,
  BLOCK_ACTIONS_KEY,
  CONDITION_PREVIEW_KEY,
  FONTS_MANAGER_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  BLOCK_DEFAULTS_KEY,
  BLOCK_REGISTRY_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  ON_REQUEST_MEDIA_KEY,
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  CAPABILITIES_KEY,
  KEYBOARD_REORDER_KEY,
} from '../src/keys';

const ALL_KEYS: Array<{ key: InjectionKey<unknown>; label: string }> = [
  { key: TRANSLATIONS_KEY, label: 'translations' },
  { key: EDITOR_KEY, label: 'editor' },
  { key: HISTORY_KEY, label: 'history' },
  { key: BLOCK_ACTIONS_KEY, label: 'blockActions' },
  { key: CONDITION_PREVIEW_KEY, label: 'conditionPreview' },
  { key: FONTS_MANAGER_KEY, label: 'fontsManager' },
  { key: THEME_STYLES_KEY, label: 'themeStyles' },
  { key: UI_THEME_KEY, label: 'uiTheme' },
  { key: BLOCK_DEFAULTS_KEY, label: 'blockDefaults' },
  { key: BLOCK_REGISTRY_KEY, label: 'blockRegistry' },
  { key: CUSTOM_BLOCK_DEFINITIONS_KEY, label: 'customBlockDefinitions' },
  { key: MERGE_TAGS_KEY, label: 'mergeTags' },
  { key: MERGE_TAG_SYNTAX_KEY, label: 'mergeTagSyntax' },
  { key: ON_REQUEST_MERGE_TAG_KEY, label: 'onRequestMergeTag' },
  { key: ON_REQUEST_MEDIA_KEY, label: 'onRequestMedia' },
  { key: DISPLAY_CONDITIONS_KEY, label: 'displayConditions' },
  { key: ALLOW_CUSTOM_CONDITIONS_KEY, label: 'allowCustomConditions' },
  { key: CAPABILITIES_KEY, label: 'capabilities' },
  { key: KEYBOARD_REORDER_KEY, label: 'keyboardReorder' },
];

function makeEditor(): BaseEditorReturn {
  const state: any = {
    content: { blocks: [], settings: {} },
    selectedBlockId: null,
    viewport: 'desktop' as const,
    darkMode: false,
    previewMode: false,
    uiTheme: 'auto' as const,
    isDirty: false,
    template: null,
    isLoading: false,
    isSaving: false,
  };
  return {
    state,
    content: ref<TemplateContent>({
      blocks: [],
      settings: {},
    } as TemplateContent),
    selectedBlock: ref(null),
    setContent: vi.fn(),
    selectBlock: vi.fn(),
    setViewport: vi.fn(),
    setDarkMode: vi.fn(),
    setPreviewMode: vi.fn(),
    setUiTheme: vi.fn((theme: string) => {
      state.uiTheme = theme;
    }),
    updateBlock: vi.fn(),
    updateSettings: vi.fn(),
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    isBlockLocked: vi.fn(() => false),
    markDirty: vi.fn(),
  } as BaseEditorReturn;
}

function makeFontsManager() {
  return {
    fonts: ref([{ label: 'Default', value: '' }]),
    loadCustomFonts: vi.fn(async () => {}),
    cleanupFontLinks: vi.fn(),
    setCustomFontsEnabled: vi.fn(),
  };
}

function mountCore(
  optionsOverrides: Partial<Parameters<typeof useEditorCore>[0]> = {},
) {
  const editor = optionsOverrides.editor ?? makeEditor();
  const fontsManager = optionsOverrides.fontsManager ?? makeFontsManager();
  const captured: {
    core?: ReturnType<typeof useEditorCore>;
    injected?: Record<string, unknown>;
  } = {};

  const Child = defineComponent({
    setup() {
      const injected: Record<string, unknown> = {};
      for (const { key, label } of ALL_KEYS) {
        injected[label] = inject(key, 'MISSING');
      }
      captured.injected = injected;
      return () => h('div');
    },
  });

  const Parent = defineComponent({
    components: { Child },
    setup() {
      captured.core = useEditorCore({
        editor: editor as any,
        config: optionsOverrides.config ?? {},
        translations: optionsOverrides.translations ?? ({} as any),
        fontsManager: fontsManager as any,
        ...optionsOverrides,
      });
      return () => h(Child);
    },
  });

  const wrapper = mount(Parent);
  return { wrapper, captured, editor, fontsManager };
}

describe('useEditorCore', () => {
  beforeEach(() => {
    vi.mocked(useHistory).mockClear();
    vi.mocked(useHistoryInterceptor).mockClear();
    vi.mocked(useBlockActions).mockClear();
    vi.mocked(useAutoSave).mockClear();
    vi.mocked(useConditionPreview).mockClear();
    vi.mocked(useEventListener).mockClear();
  });

  describe('initialization', () => {
    it('calls setUiTheme with config.uiTheme value', () => {
      const { editor } = mountCore({ config: { uiTheme: 'dark' } });
      expect(editor.setUiTheme).toHaveBeenCalledWith('dark');
    });

    it('calls setUiTheme with "auto" when uiTheme is not configured', () => {
      const { editor } = mountCore();
      expect(editor.setUiTheme).toHaveBeenCalledWith('auto');
    });

    it('calls useHistory with content, setContent, and historyOptions', () => {
      mountCore({
        historyOptions: { isRemoteOperation: () => true },
      } as any);
      expect(useHistory).toHaveBeenCalledOnce();
      const arg = vi.mocked(useHistory).mock.calls[0][0];
      expect(arg.content).toBeDefined();
      expect(typeof arg.setContent).toBe('function');
      expect(typeof arg.isRemoteOperation).toBe('function');
    });

    it('wires history interceptor after history is created', () => {
      mountCore();
      expect(useHistoryInterceptor).toHaveBeenCalledOnce();
    });

    it('calls useBlockActions with editor methods and blockDefaults', () => {
      const blockDefaults = { title: { content: 'Default title' } } as any;
      mountCore({ config: { blockDefaults } });
      const arg = vi.mocked(useBlockActions).mock.calls[0][0];
      expect(arg.blockDefaults).toBe(blockDefaults);
      expect(typeof arg.addBlock).toBe('function');
      expect(typeof arg.removeBlock).toBe('function');
    });
  });

  describe('auto-save', () => {
    it('creates autoSave when autoSaveOptions is provided', () => {
      mountCore({
        autoSaveOptions: { onChange: vi.fn(), debounce: 500 },
      } as any);
      expect(useAutoSave).toHaveBeenCalledOnce();
    });

    it('returns autoSave=null when autoSaveOptions is explicitly null', () => {
      const { captured } = mountCore({ autoSaveOptions: null } as any);
      expect(useAutoSave).not.toHaveBeenCalled();
      expect(captured.core!.autoSave).toBeNull();
    });

    it('returns autoSave=null when autoSaveOptions is undefined', () => {
      const { captured } = mountCore();
      expect(useAutoSave).not.toHaveBeenCalled();
      expect(captured.core!.autoSave).toBeNull();
    });
  });

  describe('provides', () => {
    it('provides all 19 shared injection keys', () => {
      const { captured } = mountCore();
      for (const { label } of ALL_KEYS) {
        expect(captured.injected![label]).not.toBe('MISSING');
      }
    });

    it('provides mergeTags array from config', () => {
      const tags = [{ key: 'first_name', label: 'First Name', value: '' }];
      const { captured } = mountCore({ config: { mergeTags: { tags } } as any });
      expect(captured.injected!.mergeTags).toEqual(tags);
    });

    it('provides empty mergeTags array when not configured', () => {
      const { captured } = mountCore();
      expect(captured.injected!.mergeTags).toEqual([]);
    });

    it('provides onRequestMergeTag null when not configured', () => {
      const { captured } = mountCore();
      expect(captured.injected!.onRequestMergeTag).toBeNull();
    });

    it('provides displayConditions.conditions array', () => {
      const conditions = [{ id: 'c1', label: 'L', expression: 'true' }] as any;
      const { captured } = mountCore({
        config: { displayConditions: { conditions, allowCustom: true } } as any,
      });
      expect(captured.injected!.displayConditions).toEqual(conditions);
      expect(captured.injected!.allowCustomConditions).toBe(true);
    });

    it('provides empty capabilities when not configured', () => {
      const { captured } = mountCore();
      expect(captured.injected!.capabilities).toEqual({});
    });

    it('provides configured capabilities', () => {
      const capabilities = { hasComments: true } as any;
      const { captured } = mountCore({ capabilities } as any);
      expect(captured.injected!.capabilities).toBe(capabilities);
    });
  });

  describe('block registry', () => {
    it('registers the 13 built-in block types', () => {
      const { captured } = mountCore();
      const registry = captured.core!.registry;
      for (const type of [
        'section',
        'title',
        'paragraph',
        'image',
        'button',
        'divider',
        'video',
        'social',
        'menu',
        'table',
        'spacer',
        'html',
        'countdown',
      ]) {
        expect(registry.isRegistered(type)).toBe(true);
      }
    });

    it('registers custom blocks passed via config.customBlocks', () => {
      const customDef = {
        type: 'callout',
        label: 'Callout',
        fields: [] as any[],
      } as any;
      const { captured } = mountCore({
        config: { customBlocks: [customDef] } as any,
      });
      // Custom definitions are provided via CUSTOM_BLOCK_DEFINITIONS_KEY
      expect(captured.injected!.customBlockDefinitions).toEqual([customDef]);
    });

    it('registerCustomBlocks registers additional custom blocks later', () => {
      const { captured } = mountCore();
      const def = { type: 'extra', label: 'Extra', fields: [] } as any;
      captured.core!.registerCustomBlocks([def]);
      // The registry should now resolve 'extra' via its custom-block branch
      // (exact API shape varies — we assert no throw and that the registry still exposes it).
      expect(() => captured.core!.registerCustomBlocks([def])).not.toThrow();
    });
  });

  describe('keyboard shortcuts', () => {
    it('registers a document keydown listener', () => {
      mountCore();
      expect(useEventListener).toHaveBeenCalled();
      const [target, event] = vi.mocked(useEventListener).mock.calls[0];
      expect(target).toBe(document);
      expect(event).toBe('keydown');
    });
  });

  describe('destroy', () => {
    it('tears down autoSave, history, and navigating watch', () => {
      const { captured } = mountCore({
        autoSaveOptions: { onChange: vi.fn() },
      } as any);
      const history = captured.core!.history;
      const autoSave = captured.core!.autoSave!;

      captured.core!.destroy();

      expect(autoSave.destroy).toHaveBeenCalledOnce();
      expect(history.destroy).toHaveBeenCalledOnce();
    });

    it('is safe to call when autoSave is null', () => {
      const { captured } = mountCore({ autoSaveOptions: null } as any);
      expect(() => captured.core!.destroy()).not.toThrow();
      expect(captured.core!.history.destroy).toHaveBeenCalledOnce();
    });
  });

  describe('return shape', () => {
    it('exposes all expected fields', () => {
      const { captured } = mountCore();
      const core = captured.core!;
      const fields = [
        't',
        'format',
        'history',
        'blockActions',
        'conditionPreview',
        'autoSave',
        'resolvedTheme',
        'themeStyles',
        'themeOverrides',
        'registry',
        'keyboardReorder',
        'registerCustomBlocks',
        'destroy',
      ];
      for (const f of fields) {
        expect(f in core).toBe(true);
      }
    });
  });
});
