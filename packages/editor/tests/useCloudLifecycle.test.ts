import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { Template, TemplateContent } from '@templatical/types';
import { useCloudLifecycle } from '../src/cloud/composables/useCloudLifecycle';

vi.mock('@templatical/core/cloud', () => ({
  resolveWebSocketConfig: (cfg: unknown) => cfg,
}));

vi.mock('../src/utils/preRenderCustomBlocks', () => ({
  preRenderCustomBlocks: vi.fn().mockResolvedValue(undefined),
}));

import { preRenderCustomBlocks } from '../src/utils/preRenderCustomBlocks';

function makeTemplate(id = 'tpl-1', content: any = { blocks: [], settings: {} }): Template {
  return { id, content } as Template;
}

function setup(overrides: any = {}) {
  const destroyed = { value: false };
  const template = makeTemplate();

  const editor = {
    create: vi.fn().mockResolvedValue(template),
    load: vi.fn().mockResolvedValue(template),
    save: vi.fn().mockResolvedValue(template),
    content: ref<TemplateContent>({ blocks: [], settings: {} } as TemplateContent),
    ...overrides.editor,
  };
  const websocket = { connect: vi.fn(), disconnect: vi.fn(), ...overrides.websocket };
  const planConfigInstance = {
    config: ref({ websocket: { pusherKey: 'k', pusherCluster: 'c' } }),
    ...overrides.planConfigInstance,
  };
  const snapshotPreview = {
    initSnapshotHistory: vi.fn(),
    snapshotHistoryInstance: ref<any>({ loadSnapshots: vi.fn() }),
    ...overrides.snapshotPreview,
  };
  const core = { registry: { renderCustomBlock: vi.fn() }, ...overrides.core };
  const exporter = {
    exportHtml: vi
      .fn()
      .mockResolvedValue({ html: '<html/>', mjml: '<mj/>' }),
    ...overrides.exporter,
  };
  const featureFlags = {
    isSaveExporting: ref(false),
    saveStatus: ref<'idle' | 'saved' | 'error'>('idle'),
    saveErrorMessage: ref<string | null>(null),
    startSaveStatusClear: vi.fn(),
    ...overrides.featureFlags,
  };
  const config = {
    onCreate: vi.fn(),
    onLoad: vi.fn(),
    onSave: vi.fn(),
    ...overrides.config,
  };

  const lifecycle = useCloudLifecycle({
    config: config as any,
    editor: editor as any,
    websocket: websocket as any,
    planConfigInstance: planConfigInstance as any,
    snapshotPreview: snapshotPreview as any,
    core: core as any,
    exporter: exporter as any,
    featureFlags: featureFlags as any,
    isDestroyed: () => destroyed.value,
  });

  return {
    lifecycle,
    editor,
    websocket,
    snapshotPreview,
    exporter,
    featureFlags,
    config,
    template,
    destroy: () => {
      destroyed.value = true;
    },
  };
}

describe('useCloudLifecycle', () => {
  beforeEach(() => {
    vi.mocked(preRenderCustomBlocks).mockClear();
    vi.mocked(preRenderCustomBlocks).mockResolvedValue(undefined);
  });

  describe('createTemplate', () => {
    it('calls editor.create, onCreate, snapshot init, and websocket.connect', async () => {
      const ctx = setup();
      const result = await ctx.lifecycle.createTemplate({
        blocks: [],
        settings: {},
      } as TemplateContent);

      expect(ctx.editor.create).toHaveBeenCalledWith({ blocks: [], settings: {} });
      expect(ctx.config.onCreate).toHaveBeenCalledWith(result);
      expect(ctx.snapshotPreview.initSnapshotHistory).toHaveBeenCalledOnce();
      expect(ctx.websocket.connect).toHaveBeenCalledWith('tpl-1', {
        pusherKey: 'k',
        pusherCluster: 'c',
      });
    });

    it('skips onCreate / snapshot / websocket when unmounted mid-create', async () => {
      const ctx = setup();
      ctx.editor.create.mockImplementation(async () => {
        ctx.destroy();
        return ctx.template;
      });

      const result = await ctx.lifecycle.createTemplate();

      expect(result.id).toBe('tpl-1');
      expect(ctx.config.onCreate).not.toHaveBeenCalled();
      expect(ctx.snapshotPreview.initSnapshotHistory).not.toHaveBeenCalled();
      expect(ctx.websocket.connect).not.toHaveBeenCalled();
    });

    it('propagates editor.create rejection', async () => {
      const ctx = setup();
      ctx.editor.create.mockRejectedValue(new Error('boom'));
      await expect(ctx.lifecycle.createTemplate()).rejects.toThrow('boom');
    });
  });

  describe('loadTemplate', () => {
    it('calls editor.load, onLoad, snapshot init, and websocket.connect', async () => {
      const ctx = setup();
      await ctx.lifecycle.loadTemplate('tpl-9');

      expect(ctx.editor.load).toHaveBeenCalledWith('tpl-9');
      expect(ctx.config.onLoad).toHaveBeenCalled();
      expect(ctx.snapshotPreview.initSnapshotHistory).toHaveBeenCalledOnce();
      expect(ctx.websocket.connect).toHaveBeenCalled();
    });

    it('skips side effects when unmounted mid-load', async () => {
      const ctx = setup();
      ctx.editor.load.mockImplementation(async () => {
        ctx.destroy();
        return ctx.template;
      });

      await ctx.lifecycle.loadTemplate('tpl-x');

      expect(ctx.config.onLoad).not.toHaveBeenCalled();
      expect(ctx.websocket.connect).not.toHaveBeenCalled();
    });
  });

  describe('saveTemplate', () => {
    it('runs pre-render → save → export → onSave and transitions status idle→saved', async () => {
      const ctx = setup();
      const result = await ctx.lifecycle.saveTemplate();

      expect(preRenderCustomBlocks).toHaveBeenCalled();
      expect(ctx.editor.save).toHaveBeenCalled();
      expect(ctx.exporter.exportHtml).toHaveBeenCalledWith('tpl-1');
      expect(result).toEqual({
        templateId: 'tpl-1',
        html: '<html/>',
        mjml: '<mj/>',
        content: { blocks: [], settings: {} },
      });
      expect(ctx.config.onSave).toHaveBeenCalledWith(result);
      expect(ctx.featureFlags.saveStatus.value).toBe('saved');
      expect(ctx.featureFlags.startSaveStatusClear).toHaveBeenCalledOnce();
      expect(ctx.featureFlags.isSaveExporting.value).toBe(false);
    });

    it('sets saveStatus=error and saveErrorMessage when export fails', async () => {
      const ctx = setup();
      ctx.exporter.exportHtml.mockRejectedValue(new Error('export boom'));

      await expect(ctx.lifecycle.saveTemplate()).rejects.toThrow('export boom');

      expect(ctx.featureFlags.saveStatus.value).toBe('error');
      expect(ctx.featureFlags.saveErrorMessage.value).toBe('export boom');
      expect(ctx.featureFlags.isSaveExporting.value).toBe(false);
    });

    it('uses generic message when thrown value is not an Error', async () => {
      const ctx = setup();
      ctx.exporter.exportHtml.mockRejectedValue('str');
      await expect(ctx.lifecycle.saveTemplate()).rejects.toBe('str');
      expect(ctx.featureFlags.saveErrorMessage.value).toBe('Save failed');
    });

    it('throws "unmounted during save" and skips side effects when destroyed after pre-render', async () => {
      const ctx = setup();
      vi.mocked(preRenderCustomBlocks).mockImplementation(async () => {
        ctx.destroy();
      });

      await expect(ctx.lifecycle.saveTemplate()).rejects.toThrow(
        'Component unmounted during save',
      );

      expect(ctx.editor.save).not.toHaveBeenCalled();
      expect(ctx.config.onSave).not.toHaveBeenCalled();
    });

    it('throws and skips export/onSave when destroyed after editor.save', async () => {
      const ctx = setup();
      ctx.editor.save.mockImplementation(async () => {
        ctx.destroy();
        return ctx.template;
      });

      await expect(ctx.lifecycle.saveTemplate()).rejects.toThrow(
        'Component unmounted during save',
      );

      expect(ctx.exporter.exportHtml).not.toHaveBeenCalled();
      expect(ctx.config.onSave).not.toHaveBeenCalled();
    });

    it('does not update feature flags on error when destroyed', async () => {
      const ctx = setup();
      ctx.exporter.exportHtml.mockImplementation(async () => {
        ctx.destroy();
        throw new Error('post-destroy');
      });

      await expect(ctx.lifecycle.saveTemplate()).rejects.toThrow('post-destroy');

      expect(ctx.featureFlags.saveStatus.value).toBe('idle');
      expect(ctx.featureFlags.saveErrorMessage.value).toBe(null);
    });

    it('resets saveStatus to idle at the start of each save', async () => {
      const ctx = setup();
      ctx.featureFlags.saveStatus.value = 'error';
      await ctx.lifecycle.saveTemplate();
      expect(ctx.featureFlags.saveStatus.value).toBe('saved');
    });
  });
});
