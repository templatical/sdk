import { computed, shallowRef, ref, type ComputedRef, type Ref } from "vue";
import type { TemplateContent, TemplateSnapshot } from "@templatical/types";
import type {
  UseHistoryReturn,
  UseConditionPreviewReturn,
  UseAutoSaveReturn,
} from "@templatical/core";
import {
  useSnapshotHistory,
  type AuthManager,
  type UseSnapshotHistoryReturn,
} from "@templatical/core/cloud";
import type { BaseEditorReturn } from "../../composables/useEditorCore";

export interface UseSnapshotPreviewOptions {
  authManager: AuthManager;
  editor: BaseEditorReturn & {
    hasTemplate: () => boolean;
    createSnapshot: () => Promise<void>;
  };
  history: UseHistoryReturn;
  conditionPreview: UseConditionPreviewReturn;
  autoSave: UseAutoSaveReturn | null;
  onError?: (error: Error) => void;
}

export interface UseSnapshotPreviewReturn {
  snapshotHistoryInstance: Ref<UseSnapshotHistoryReturn | null>;
  previewingSnapshot: Ref<TemplateSnapshot | null>;
  contentBeforePreview: Ref<TemplateContent | null>;
  isPreviewingSnapshot: ComputedRef<boolean>;
  snapshotHistorySnapshots: ComputedRef<TemplateSnapshot[]>;
  snapshotHistoryIsLoading: ComputedRef<boolean>;
  snapshotHistoryIsRestoring: ComputedRef<boolean>;
  initSnapshotHistory: () => void;
  handleRestore: (template: { content: TemplateContent }) => void;
  handleSnapshotNavigate: (snapshot: TemplateSnapshot) => Promise<void>;
  confirmRestoreSnapshot: () => Promise<void>;
  cancelPreview: () => void;
  loadSnapshotHistory: () => Promise<void>;
}

export function useSnapshotPreview(
  options: UseSnapshotPreviewOptions,
): UseSnapshotPreviewReturn {
  const { authManager, editor, history, conditionPreview, autoSave, onError } =
    options;

  const snapshotHistoryInstance = shallowRef<UseSnapshotHistoryReturn | null>(
    null,
  );
  const previewingSnapshot = ref<TemplateSnapshot | null>(null);
  const contentBeforePreview = ref<TemplateContent | null>(null);

  const isPreviewingSnapshot = computed(
    () => previewingSnapshot.value !== null,
  );
  const snapshotHistorySnapshots = computed(
    () => snapshotHistoryInstance.value?.snapshots.value ?? [],
  );
  const snapshotHistoryIsLoading = computed(
    () => snapshotHistoryInstance.value?.isLoading.value ?? false,
  );
  const snapshotHistoryIsRestoring = computed(
    () => snapshotHistoryInstance.value?.isRestoring.value ?? false,
  );

  function initSnapshotHistory(): void {
    if (editor.state.template?.id && !snapshotHistoryInstance.value) {
      snapshotHistoryInstance.value = useSnapshotHistory({
        authManager,
        templateId: editor.state.template.id,
        onRestore: handleRestore,
        onError,
      });
      snapshotHistoryInstance.value.loadSnapshots();
    }
  }

  function handleRestore(template: { content: TemplateContent }): void {
    editor.setContent(template.content, false);
    history.clear();
    conditionPreview.reset();
  }

  async function handleSnapshotNavigate(
    snapshot: TemplateSnapshot,
  ): Promise<void> {
    if (previewingSnapshot.value) {
      previewingSnapshot.value = snapshot;
      editor.setContent(snapshot.content, false);
      return;
    }

    if (editor.state.isDirty && editor.hasTemplate()) {
      await editor.createSnapshot();
    }

    contentBeforePreview.value = structuredClone(editor.content.value);

    autoSave?.pause();
    previewingSnapshot.value = snapshot;
    editor.setContent(snapshot.content, false);
  }

  async function confirmRestoreSnapshot(): Promise<void> {
    if (!previewingSnapshot.value || !snapshotHistoryInstance.value) return;

    try {
      await snapshotHistoryInstance.value.restoreSnapshot(
        previewingSnapshot.value.id,
      );
      await snapshotHistoryInstance.value.loadSnapshots();
    } finally {
      previewingSnapshot.value = null;
      contentBeforePreview.value = null;
      autoSave?.resume();
    }
  }

  function cancelPreview(): void {
    if (!previewingSnapshot.value || !contentBeforePreview.value) return;

    editor.setContent(contentBeforePreview.value, false);

    previewingSnapshot.value = null;
    contentBeforePreview.value = null;

    autoSave?.resume();
  }

  async function loadSnapshotHistory(): Promise<void> {
    if (snapshotHistoryInstance.value) {
      await snapshotHistoryInstance.value.loadSnapshots();
    }
  }

  return {
    snapshotHistoryInstance,
    previewingSnapshot,
    contentBeforePreview,
    isPreviewingSnapshot,
    snapshotHistorySnapshots,
    snapshotHistoryIsLoading,
    snapshotHistoryIsRestoring,
    initSnapshotHistory,
    handleRestore,
    handleSnapshotNavigate,
    confirmRestoreSnapshot,
    cancelPreview,
    loadSnapshotHistory,
  };
}
