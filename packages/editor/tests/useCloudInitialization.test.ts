// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, computed } from 'vue';
import { mount } from '@vue/test-utils';

// --- Mocks: stub every heavy dep so we exercise only the orchestration logic ---

const mockAuthManager = {
  initialize: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@templatical/core/cloud', () => {
  const editor = {
    state: { template: null },
    content: ref({ blocks: [], settings: {} }),
    setUiTheme: vi.fn(),
    moveBlock: vi.fn(),
    addBlock: vi.fn(),
    save: vi.fn(),
    hasTemplate: vi.fn(() => false),
    createSnapshot: vi.fn(),
  };
  return {
    AuthManager: vi.fn(function (this: any) {
      Object.assign(this, mockAuthManager);
    }),
    performHealthCheck: vi.fn().mockResolvedValue({
      api: { ok: true },
      auth: { ok: true },
      websocket: { ok: true },
    }),
    useAiConfig: vi.fn(() => ({ enabled: computed(() => false) })),
    useCollaboration: vi.fn(() => ({
      lockedBlocks: ref(new Map()),
      collaborators: ref([]),
      _broadcastOperation: vi.fn(),
      _isProcessingRemoteOperation: vi.fn(() => false),
    })),
    useCollaborationBroadcast: vi.fn(),
    useCommentListener: vi.fn(),
    useComments: vi.fn(() => ({
      commentCountByBlock: ref(new Map()),
    })),
    useEditor: vi.fn(() => editor),
    useExport: vi.fn(() => ({ exportHtml: vi.fn() })),
    useMcpListener: vi.fn(),
    usePlanConfig: vi.fn(() => ({
      config: ref(null),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => true),
    })),
    useSavedModules: vi.fn(() => ({
      modules: ref([]),
      loadModules: vi.fn(),
    })),
    useTemplateScoring: vi.fn(() => ({ fixError: ref(null) })),
    useTestEmail: vi.fn(() => ({})),
    useWebSocket: vi.fn(() => ({
      channel: ref(null),
      disconnect: vi.fn(),
      getSocketId: vi.fn(() => null),
    })),
  };
});

vi.mock('../src/composables/useEditorCore', () => ({
  useEditorCore: vi.fn(() => ({
    t: {} as any,
    format: vi.fn(),
    history: {
      canUndo: ref(false),
      destroy: vi.fn(),
    },
    blockActions: {},
    conditionPreview: {},
    autoSave: null,
    resolvedTheme: computed(() => 'light'),
    themeStyles: computed(() => ({})),
    themeOverrides: ref({}),
    registry: {},
    keyboardReorder: {},
    registerCustomBlocks: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('../src/composables/useDragDrop', () => ({
  useDragDrop: vi.fn(),
}));

vi.mock('./useSnapshotPreview', () => ({
  useSnapshotPreview: vi.fn(() => ({
    snapshotHistoryInstance: ref(null),
    initSnapshotHistory: vi.fn(),
  })),
}));

vi.mock('./useCloudPanelState', () => ({
  useCloudPanelState: vi.fn(() => ({
    commentsOpen: ref(false),
    mediaLibraryOpen: ref(false),
    mediaLibraryAccept: ref(null),
  })),
}));

vi.mock('./useCollabUndoWarning', () => ({
  useCollabUndoWarning: vi.fn(() => ({
    showCollabUndoWarning: vi.fn(),
  })),
}));

vi.mock('./useCloudFeatureFlags', () => ({
  useCloudFeatureFlags: vi.fn(() => ({})),
}));

vi.mock('./useCloudMediaLibrary', () => ({
  useCloudMediaLibrary: vi.fn(() => ({
    handleRequestMedia: vi.fn(),
  })),
}));

import {
  performHealthCheck,
  useCollaboration,
  useCollaborationBroadcast,
} from '@templatical/core/cloud';
import { useEditorCore } from '../src/composables/useEditorCore';
import { useCloudInitialization } from '../src/cloud/composables/useCloudInitialization';

function baseOptions(overrides: any = {}): any {
  return {
    config: {
      auth: {},
      ...overrides.config,
    },
    translations: { canvas: { dropHere: 'Drop here' } } as any,
    fontsManager: {
      fonts: ref([]),
      loadCustomFonts: vi.fn(),
      cleanupFontLinks: vi.fn(),
      setCustomFontsEnabled: vi.fn(),
    } as any,
    emit: vi.fn(),
    getCommentsSidebar: vi.fn(() => null),
    ...overrides,
  };
}

function mountInit(overrides: any = {}) {
  const options = baseOptions(overrides);
  let captured!: ReturnType<typeof useCloudInitialization>;
  const wrapper = mount(
    defineComponent({
      setup() {
        captured = useCloudInitialization(options);
        return () => h('div');
      },
    }),
  );
  return { wrapper, init: () => captured, options };
}

describe('useCloudInitialization', () => {
  beforeEach(() => {
    mockAuthManager.initialize.mockClear().mockResolvedValue(undefined);
    vi.mocked(performHealthCheck).mockClear().mockResolvedValue({
      api: { ok: true },
      auth: { ok: true },
      websocket: { ok: true },
    } as any);
    vi.mocked(useCollaboration).mockClear();
    vi.mocked(useCollaborationBroadcast).mockClear();
    vi.mocked(useEditorCore).mockClear();
  });

  describe('construction', () => {
    it('starts with isInitializing=true and isAuthReady=false', () => {
      const { init } = mountInit();
      expect(init().isInitializing.value).toBe(true);
      expect(init().isAuthReady.value).toBe(false);
      expect(init().initError.value).toBeNull();
      expect(init().isDestroyed()).toBe(false);
    });

    it('does NOT set up collaboration when config.collaboration.enabled is false', () => {
      mountInit({ config: {} });
      expect(useCollaboration).not.toHaveBeenCalled();
      expect(useCollaborationBroadcast).not.toHaveBeenCalled();
    });

    it('sets up collaboration when enabled', () => {
      mountInit({ config: { collaboration: { enabled: true } } });
      expect(useCollaboration).toHaveBeenCalledOnce();
      expect(useCollaborationBroadcast).toHaveBeenCalledOnce();
    });

    it('calls collab broadcast AFTER useCollaboration but BEFORE useEditorCore (history interceptor order)', () => {
      mountInit({ config: { collaboration: { enabled: true } } });
      const collabOrder = vi.mocked(useCollaboration).mock.invocationCallOrder[0];
      const broadcastOrder = vi.mocked(useCollaborationBroadcast).mock.invocationCallOrder[0];
      const coreOrder = vi.mocked(useEditorCore).mock.invocationCallOrder[0];
      expect(collabOrder).toBeLessThan(broadcastOrder);
      expect(broadcastOrder).toBeLessThan(coreOrder);
    });
  });

  describe('initialize()', () => {
    it('sets isAuthReady=true after authManager.initialize succeeds', async () => {
      const { init } = mountInit();
      await init().initialize();
      expect(init().isAuthReady.value).toBe(true);
      expect(init().isInitializing.value).toBe(false);
    });

    it('emits "ready" on successful init', async () => {
      const { init, options } = mountInit();
      await init().initialize();
      expect(options.emit).toHaveBeenCalledWith('ready');
    });

    it('sets initError when health check fails (API down)', async () => {
      vi.mocked(performHealthCheck).mockResolvedValue({
        api: { ok: false },
        auth: { ok: true },
        websocket: { ok: true },
      } as any);
      const onError = vi.fn();
      const { init } = mountInit({ config: { onError } });
      await init().initialize();

      expect(init().initError.value).toBeInstanceOf(Error);
      expect(init().initError.value!.message).toContain('API is not reachable');
      expect(onError).toHaveBeenCalledWith(init().initError.value);
      expect(init().isInitializing.value).toBe(false);
    });

    it('sets initError when auth health check fails', async () => {
      vi.mocked(performHealthCheck).mockResolvedValue({
        api: { ok: true },
        auth: { ok: false, error: 'Invalid token' },
        websocket: { ok: true },
      } as any);
      const { init } = mountInit();
      await init().initialize();

      expect(init().initError.value!.message).toContain('authentication error');
      expect(init().initError.value!.message).toContain('Invalid token');
    });

    it('tolerates websocket health failure (logs warning, continues)', async () => {
      vi.mocked(performHealthCheck).mockResolvedValue({
        api: { ok: true },
        auth: { ok: true },
        websocket: { ok: false, error: 'ws down' },
      } as any);
      const { init, options } = mountInit();
      await init().initialize();

      expect(init().initError.value).toBeNull();
      expect(options.emit).toHaveBeenCalledWith('ready');
    });

    it('wraps non-Error thrown values in an Error with cause', async () => {
      mockAuthManager.initialize.mockRejectedValue('string error');
      const { init } = mountInit();
      await init().initialize();

      expect(init().initError.value).toBeInstanceOf(Error);
      expect(init().initError.value!.message).toBe('Initialization failed');
    });

    it('aborts silently when destroyed before auth resolves', async () => {
      mockAuthManager.initialize.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );
      const { init, options } = mountInit();
      const promise = init().initialize();
      init().destroy();
      mockAuthManager.initialize.mockResolvedValue(undefined as any);
      // allow microtasks
      await Promise.resolve();

      expect(init().isAuthReady.value).toBe(false);
      expect(options.emit).not.toHaveBeenCalled();
      promise.catch(() => {});
    });

    it('skips state updates when destroyed mid-init (after auth resolves)', async () => {
      const { init, options } = mountInit();
      mockAuthManager.initialize.mockImplementation(async () => {
        init().destroy();
      });
      await init().initialize();

      expect(init().isAuthReady.value).toBe(false);
      expect(options.emit).not.toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('flips isDestroyed() to true', () => {
      const { init } = mountInit();
      expect(init().isDestroyed()).toBe(false);
      init().destroy();
      expect(init().isDestroyed()).toBe(true);
    });

    it('calls fontsManager.cleanupFontLinks, websocket.disconnect, and core.destroy', () => {
      const { init, options } = mountInit();
      const websocket = init().websocket;
      const core = init().core;

      init().destroy();

      expect(options.fontsManager.cleanupFontLinks).toHaveBeenCalledOnce();
      expect(websocket.disconnect).toHaveBeenCalledOnce();
      expect(core.destroy).toHaveBeenCalledOnce();
    });

    it('calls config.onUnmount hook if provided', () => {
      const onUnmount = vi.fn();
      const { init } = mountInit({ config: { onUnmount } });
      init().destroy();
      expect(onUnmount).toHaveBeenCalledOnce();
    });

    it('sets _destroyed = true BEFORE calling websocket.disconnect (guards late callbacks)', () => {
      const { init } = mountInit();
      const websocket = init().websocket;

      let flagAtDisconnect: boolean | null = null;
      vi.mocked(websocket.disconnect).mockImplementation(() => {
        flagAtDisconnect = init().isDestroyed();
      });

      init().destroy();
      expect(flagAtDisconnect).toBe(true);
    });
  });

  describe('setThemeOverrides', () => {
    it('applies overrides when plan supports theme_customization', () => {
      const { init } = mountInit();
      const overrides = { colors: { primary: '#000' } } as any;
      init().setThemeOverrides(overrides);
      expect(init().core.themeOverrides.value).toEqual(overrides);
    });
  });

  describe('openCommentsForBlock', () => {
    it('opens comments panel and filters by block id', async () => {
      const filterByBlock = vi.fn();
      const { init } = mountInit({
        getCommentsSidebar: () => ({ filterByBlock }),
      });

      init().openCommentsForBlock('block-1');

      expect(init().panelState.commentsOpen.value).toBe(true);
      await new Promise((r) => queueMicrotask(() => r(null)));
      expect(filterByBlock).toHaveBeenCalledWith('block-1');
    });

    it('is safe when the sidebar is not yet mounted', async () => {
      const { init } = mountInit({ getCommentsSidebar: () => null });
      expect(() => init().openCommentsForBlock('block-1')).not.toThrow();
      await new Promise((r) => queueMicrotask(() => r(null)));
      expect(init().panelState.commentsOpen.value).toBe(true);
    });
  });
});
