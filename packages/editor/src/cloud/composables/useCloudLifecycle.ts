import {
  resolveWebSocketConfig,
  type UseExportReturn,
  type UsePlanConfigReturn,
  type UseWebSocketReturn,
  type UseEditorReturn as CloudUseEditorReturn,
} from "@templatical/core/cloud";
import type { SaveResult, Template, TemplateContent } from "@templatical/types";

import type { UseEditorCoreReturn } from "../../composables/useEditorCore";
import { preRenderCustomBlocks } from "../../utils/preRenderCustomBlocks";

import type { UseSnapshotPreviewReturn } from "./useSnapshotPreview";
import type { UseCloudFeatureFlagsReturn } from "./useCloudFeatureFlags";
import type { TemplaticalCloudEditorConfig } from "../cloudConfig";

export interface UseCloudLifecycleOptions {
  config: TemplaticalCloudEditorConfig;
  editor: CloudUseEditorReturn;
  websocket: UseWebSocketReturn;
  planConfigInstance: UsePlanConfigReturn;
  snapshotPreview: UseSnapshotPreviewReturn;
  core: UseEditorCoreReturn;
  exporter: UseExportReturn;
  featureFlags: UseCloudFeatureFlagsReturn;
  isDestroyed: () => boolean;
}

export interface UseCloudLifecycleReturn {
  createTemplate: (content?: TemplateContent) => Promise<Template>;
  loadTemplate: (templateId: string) => Promise<Template>;
  saveTemplate: () => Promise<SaveResult>;
}

/**
 * Template-level operations on a cloud editor: create/load/save.
 * Each guards against post-unmount execution via `isDestroyed()`.
 */
export function useCloudLifecycle(
  options: UseCloudLifecycleOptions,
): UseCloudLifecycleReturn {
  const {
    config,
    editor,
    websocket,
    planConfigInstance,
    snapshotPreview,
    core,
    exporter,
    featureFlags,
    isDestroyed,
  } = options;

  function getWebSocketConfig() {
    return resolveWebSocketConfig(planConfigInstance.config.value!.websocket);
  }

  async function createTemplate(
    content?: TemplateContent,
  ): Promise<Template> {
    const template = await editor.create(content);
    if (isDestroyed()) return template;
    config.onCreate?.(template);
    snapshotPreview.initSnapshotHistory();
    websocket.connect(template.id, getWebSocketConfig());
    return template;
  }

  async function loadTemplate(templateId: string): Promise<Template> {
    const template = await editor.load(templateId);
    if (isDestroyed()) return template;
    config.onLoad?.(template);
    snapshotPreview.initSnapshotHistory();
    websocket.connect(template.id, getWebSocketConfig());
    return template;
  }

  async function saveTemplate(): Promise<SaveResult> {
    featureFlags.isSaveExporting.value = true;
    featureFlags.saveStatus.value = "idle";
    try {
      // Pre-render custom blocks so backend can include them in MJML export.
      await preRenderCustomBlocks(editor.content.value, core.registry);
      if (isDestroyed()) throw new Error("Component unmounted during save");

      const template = await editor.save();
      if (isDestroyed()) throw new Error("Component unmounted during save");

      snapshotPreview.initSnapshotHistory();
      snapshotPreview.snapshotHistoryInstance.value?.loadSnapshots();

      const exportResult = await exporter.exportHtml(template.id);
      if (isDestroyed()) throw new Error("Component unmounted during save");

      const saveResult: SaveResult = {
        templateId: template.id,
        html: exportResult.html,
        mjml: exportResult.mjml,
        content: template.content,
      };

      config.onSave?.(saveResult);

      featureFlags.saveStatus.value = "saved";
      featureFlags.startSaveStatusClear();

      return saveResult;
    } catch (error) {
      if (!isDestroyed()) {
        featureFlags.saveStatus.value = "error";
        featureFlags.saveErrorMessage.value =
          error instanceof Error ? error.message : "Save failed";
      }
      throw error;
    } finally {
      if (!isDestroyed()) {
        featureFlags.isSaveExporting.value = false;
      }
    }
  }

  return { createTemplate, loadTemplate, saveTemplate };
}
