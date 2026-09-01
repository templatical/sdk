import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from "vue";
import {
  useVersionHistory,
  type UseVersionHistoryReturn,
} from "@templatical/core";
import type {
  UseAutoSaveReturn,
  UseConditionPreviewReturn,
  UseHistoryReturn,
} from "@templatical/core";
import type {
  TemplateContent,
  TemplateVersion,
  VersionHistoryProvider,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** Minimal slice of the editor this feature needs — OSS and Cloud alike. */
interface VersionHistoryEditor {
  state: {
    readonly template?: { id: string } | null;
    readonly isDirty: boolean;
  };
  content: Ref<TemplateContent>;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
}

/**
 * How the restore confirmation persists unsaved work instead of only warning
 * about it.
 *
 * Both members are read at confirmation time rather than captured at setup, so
 * a late-bound save (Cloud's, which only exists once its lifecycle composable
 * is constructed) and a save that comes and goes (Cloud's lint gate) are both
 * expressible.
 */
export interface SaveBeforeRestore {
  /** Whether persisting is possible *right now*. */
  canSave: () => boolean;
  /** Persist the template. Rejects on failure; the confirmation stays up. */
  save: () => Promise<unknown>;
}

export interface UseVersionHistoryFeatureOptions {
  /** Storage backend — consumer-supplied in OSS, the Cloud adapter in Cloud. */
  provider: VersionHistoryProvider;
  editor: VersionHistoryEditor;
  /**
   * Lets the restore confirmation offer "save first". Omit it — or supply one
   * whose `canSave` is false, which is what a `save: false` templates provider
   * amounts to — and the confirmation degrades to a plain "these will be lost",
   * because there is then nowhere to put them.
   */
  saveBeforeRestore?: SaveBeforeRestore | null;
  history: UseHistoryReturn;
  conditionPreview: UseConditionPreviewReturn;
  /** Paused for the duration of a preview, so previewed content is never saved. */
  autoSave: UseAutoSaveReturn | null;
  onError?: (error: Error) => void;
  /**
   * Whether the feature may be used. Read reactively, so Cloud can defer to a
   * plan entitlement that resolves after its async config fetch. Omit for
   * always-available (the OSS case: a configured provider is the whole gate).
   */
  isAvailable?: () => boolean;
}

export interface UseVersionHistoryFeatureReturn {
  headless: UseVersionHistoryReturn;

  versions: ComputedRef<TemplateVersion[]>;
  isLoading: ComputedRef<boolean>;
  isRestoring: ComputedRef<boolean>;
  canCreate: ComputedRef<boolean>;
  canRestore: ComputedRef<boolean>;
  /** True once a template exists — there is no history before that. */
  hasTemplate: ComputedRef<boolean>;
  isAvailable: ComputedRef<boolean>;

  /** The version currently on the canvas, or `null` when editing normally. */
  previewingVersion: Ref<TemplateVersion | null>;
  isPreviewing: ComputedRef<boolean>;

  /** True while the unsaved-changes confirmation is up. */
  isConfirmingRestore: Ref<boolean>;
  /** Whether that confirmation may offer "save first" rather than only warn. */
  canSaveBeforeRestore: ComputedRef<boolean>;
  /**
   * True from the moment a confirmation action is taken until it settles —
   * covering the save as well as the restore, so a second click can't fire a
   * second save while the first is still in flight.
   */
  isConfirmBusy: ComputedRef<boolean>;

  /** Re-read the list. Called when the history control opens. */
  refresh: () => void;
  /**
   * Show a version on the canvas. **Synchronous once the preview is open and the
   * version's content is already in hand**, which is what keeps scrubbing
   * instant — see {@link TemplateVersion.content}.
   */
  navigate: (version: TemplateVersion) => Promise<void>;
  /**
   * What the banner's Restore button calls. Restores straight away when there is
   * nothing to lose; opens the confirmation when there are unsaved changes,
   * because {@link confirmRestore} discards the pre-preview backup and that work
   * would then exist nowhere.
   */
  requestRestore: () => Promise<void>;
  /** Confirmation's primary action: persist the unsaved work, then restore. */
  saveAndRestore: () => Promise<void>;
  /** Confirmation's destructive action: restore, losing the unsaved work. */
  discardAndRestore: () => Promise<void>;
  /** Dismiss the confirmation, staying in the preview with nothing restored. */
  cancelRestoreConfirm: () => void;
  /** Make the previewed version current. Rejects if the provider's restore does. */
  confirmRestore: () => Promise<void>;
  /** Leave the preview and put the pre-preview content back. */
  cancelPreview: () => void;

  capability: NonNullable<EditorCapabilities["versionHistory"]>;
}

/**
 * Shared glue for version history: the reactive list, the preview-before-restore
 * flow, and the capability the shared chrome gates on.
 *
 * Both `Editor.vue` (OSS) and `useCloudInitialization` (Cloud) call this with
 * their own provider, so the two entry points run identical logic over different
 * transports. Nothing here is auth- or plan-aware — callers decide whether the
 * feature is available *before* constructing it.
 */
export function useVersionHistoryFeature(
  options: UseVersionHistoryFeatureOptions,
): UseVersionHistoryFeatureReturn {
  const { provider, editor, history, conditionPreview, autoSave } = options;

  const headless = useVersionHistory({
    provider,
    getTemplateId: () => editor.state.template?.id ?? null,
    onError: options.onError,
  });

  const previewingVersion = ref<TemplateVersion | null>(null);
  const contentBeforePreview = ref<TemplateContent | null>(null);
  const isConfirmingRestore = ref(false);
  const isSavingBeforeRestore = ref(false);

  // Async functions must guard against post-unmount execution after every
  // `await` so we don't write to dead refs or fire side effects
  // (autoSave.pause, setContent) on a torn-down component.
  let destroyed = false;
  onScopeDispose(() => {
    destroyed = true;
  });

  const versions = computed(() => headless.versions.value);
  const isLoading = computed(() => headless.isLoading.value);
  const isRestoring = computed(() => headless.isRestoring.value);
  const canCreate = headless.canCreate;
  const canRestore = headless.canRestore;
  const hasTemplate = computed(() => !!editor.state.template?.id);
  const isAvailable = computed(() => options.isAvailable?.() ?? true);
  const isPreviewing = computed(() => previewingVersion.value !== null);
  const canSaveBeforeRestore = computed(
    () => options.saveBeforeRestore?.canSave() === true,
  );
  const isConfirmBusy = computed(
    () => isSavingBeforeRestore.value || isRestoring.value,
  );

  function refresh(): void {
    if (!hasTemplate.value) return;
    // Fire-and-forget: `useVersionHistory` already routes failures to `onError`,
    // and a stale list is not worth blocking the dropdown's open on.
    void headless.load().catch(() => {});
  }

  async function navigate(version: TemplateVersion): Promise<void> {
    if (destroyed) return;

    // A pending confirmation names the version it was raised for, so moving to
    // another one must retract it. Unreachable while the dialog is modal, but a
    // programmatic scrub reaches it today and an inline confirmation would.
    isConfirmingRestore.value = false;

    // Already previewing: this is a scrub. Take the synchronous path whenever
    // the content is in hand — a provider that hydrates its list (Cloud does)
    // never awaits here, and the canvas swaps in the same tick.
    if (previewingVersion.value) {
      const known = headless.peekContent(version);
      if (known) {
        previewingVersion.value = version;
        editor.setContent(known, false);
        return;
      }
      const content = await headless.resolveContent(version);
      if (destroyed) return;
      previewingVersion.value = version;
      editor.setContent(content, false);
      return;
    }

    // Entering the preview. Resolve first: a failed fetch must leave the user
    // editing, not stranded in a preview of nothing.
    const content = await headless.resolveContent(version);
    if (destroyed) return;

    // Opening a preview records nothing. The editor never authors a version —
    // whoever implements `TemplatesProvider.save` decides that. The unsaved work
    // that a confirmed restore would discard is protected at the confirmation
    // instead (see `requestRestore`), which is both where the loss happens and
    // the one place the user can be asked about it.
    //
    // `safeClone`, not `structuredClone`: what arrives here is a Vue reactive
    // proxy over the editor's content, and the structured-clone algorithm
    // refuses a proxy outright. It is also the repo's one deep-clone for
    // content, so a Sortable back-ref that leaked into block data is dropped
    // rather than thrown on.
    contentBeforePreview.value = safeClone(editor.content.value);

    autoSave?.pause();
    previewingVersion.value = version;
    editor.setContent(content, false);
  }

  async function requestRestore(): Promise<void> {
    if (!previewingVersion.value) return;

    // `setContent(…, false)` is what puts a version on the canvas, so `isDirty`
    // still describes the user's own work rather than the preview.
    if (editor.state.isDirty) {
      isConfirmingRestore.value = true;
      return;
    }
    await confirmRestore();
  }

  async function saveAndRestore(): Promise<void> {
    const version = previewingVersion.value;
    const before = contentBeforePreview.value;
    const saver = options.saveBeforeRestore;
    // The UI hides this action in each of these cases; a programmatic caller
    // gets a no-op rather than a save of the previewed version.
    if (!version || !before || !saver?.canSave()) return;
    if (isConfirmBusy.value) return;

    // The canvas is showing the *previewed* version and a save persists whatever
    // the editor holds, so put the user's work back before saving — otherwise
    // "save first" would save the very version they are about to restore.
    editor.setContent(before, false);
    isSavingBeforeRestore.value = true;
    try {
      await saver.save();
    } catch {
      // Already reported by whoever owns the save (status badge, `onError`).
      // Put the preview back so the banner and the canvas agree again, and leave
      // the confirmation up: nothing was saved and nothing was restored.
      if (destroyed) return;
      const previewed = headless.peekContent(version);
      if (previewed) editor.setContent(previewed, false);
      return;
    } finally {
      if (!destroyed) isSavingBeforeRestore.value = false;
    }
    if (destroyed) return;
    await confirmRestore();
  }

  async function discardAndRestore(): Promise<void> {
    // The dialog disables its buttons while busy; this covers a programmatic
    // caller, for whom a second restore mid-flight would append twice.
    if (isConfirmBusy.value) return;
    await confirmRestore();
  }

  function cancelRestoreConfirm(): void {
    isConfirmingRestore.value = false;
  }

  async function confirmRestore(): Promise<void> {
    if (!previewingVersion.value) return;

    try {
      const template = await headless.restore(previewingVersion.value.id);
      if (destroyed) return;
      applyRestored(template.content);
      // History is append-only: the restore added an entry, so the list the
      // dropdown shows is stale until it is re-read.
      await headless.load();
      if (destroyed) return;
    } catch (error) {
      // The canvas is still showing the previewed version (set in `navigate`),
      // so roll back to the pre-preview content before the `finally` discards
      // the backup — otherwise the user is silently left editing an un-restored
      // version with the banner gone, and the next autosave persists it.
      if (!destroyed && contentBeforePreview.value) {
        editor.setContent(contentBeforePreview.value, false);
      }
      throw error;
    } finally {
      if (!destroyed) {
        previewingVersion.value = null;
        contentBeforePreview.value = null;
        isConfirmingRestore.value = false;
        autoSave?.resume();
      }
    }
  }

  function applyRestored(content: TemplateContent): void {
    editor.setContent(content, false);
    history.clear();
    conditionPreview.reset();
  }

  function cancelPreview(): void {
    if (!previewingVersion.value || !contentBeforePreview.value) return;

    editor.setContent(contentBeforePreview.value, false);

    previewingVersion.value = null;
    contentBeforePreview.value = null;
    isConfirmingRestore.value = false;

    autoSave?.resume();
  }

  return {
    headless,

    versions,
    isLoading,
    isRestoring,
    canCreate,
    canRestore,
    hasTemplate,
    isAvailable,

    previewingVersion,
    isPreviewing,
    isConfirmingRestore,
    canSaveBeforeRestore,
    isConfirmBusy,

    refresh,
    navigate,
    requestRestore,
    saveAndRestore,
    discardAndRestore,
    cancelRestoreConfirm,
    confirmRestore,
    cancelPreview,

    capability: {
      refresh,
      isPreviewing,
      hasTemplate,
      isAvailable,
      canCreate,
      canRestore,
    },
  };
}
