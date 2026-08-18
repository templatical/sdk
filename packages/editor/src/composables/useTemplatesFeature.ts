import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useEventListener, useTimeoutFn } from "@vueuse/core";
import type {
  Template,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** How long the header shows "Saved" before falling back to the dirty state. */
const SAVED_STATUS_MS = 3000;

/** Minimal slice of the editor this feature needs. */
interface TemplatesEditor {
  state: {
    readonly template: { id: string; name?: string } | null;
    readonly isDirty: boolean;
    readonly isSaving: boolean;
  };
  setName: (name: string) => void;
  create: (input?: {
    name?: string;
    content?: TemplateContent;
  }) => Promise<Template>;
  load: (templateId: string) => Promise<Template>;
  save: () => Promise<Template>;
  hasTemplate: () => boolean;
}

/**
 * A veto over saving, supplied by whoever configured the editor.
 *
 * The one implementation is Cloud's lint save-gate: with the server policy
 * `accessibility.blockOnError` on and error-severity issues present, a manual
 * save opens a confirmation and an autosave simply does not fire. The shape is
 * generic because the header's Save must be *routable* through a gate — without
 * that, unifying the two headers would have silently dropped `blockOnError`.
 */
export interface SaveGate {
  /**
   * Manual save (header button, Cmd+S). Runs the save, or defers it and raises a
   * confirmation. Resolves to whether it ran.
   */
  tryRunSave: (run: () => Promise<unknown> | unknown) => Promise<boolean>;
  /**
   * Autosave. Runs the save only when the gate would not block, and does nothing
   * at all otherwise — no prompt on a debounce timer, and no write that would
   * demote the policy to a manual-save-only speed bump.
   */
  runUnlessBlocked: (run: () => Promise<unknown> | unknown) => Promise<boolean>;
}

export interface UseTemplatesFeatureOptions {
  /** Storage backend — consumer-supplied via `init({ templates })`. */
  provider: TemplatesProvider;
  editor: TemplatesEditor;
  /**
   * Warn on tab close while there are unsaved changes. Defaults to on; pass
   * `false` to own that guard yourself.
   */
  guardUnsavedChanges?: boolean;
  /**
   * Extra gate on top of the provider being present. Read reactively, so a
   * future adapter can defer to an entitlement that resolves after setup. Omit
   * for always-available (the OSS case: a configured provider is the whole gate).
   */
  isAvailable?: () => boolean;
  /**
   * Optional veto over every save this feature performs. Read through a getter
   * rather than passed by value because Cloud builds its gate from
   * `core.templateLint`, which only exists after `useEditorCore()` — i.e. after
   * this composable is constructed.
   */
  getSaveGate?: () => SaveGate | null;
}

export interface UseTemplatesFeatureReturn {
  /** Persist the loaded template. Rejects — see {@link requestSave} for UI. */
  save: () => Promise<Template>;
  /** Persist the current content as a new template. Rejects on failure. */
  create: (input?: {
    name?: string;
    content?: TemplateContent;
  }) => Promise<Template>;
  /** Fetch a template. Passed straight through; saving status is untouched. */
  load: (templateId: string) => Promise<Template>;
  /**
   * Fire-and-forget save for the header button and Cmd+S: the outcome is already
   * reported through {@link status}, so nothing is left for a caller to handle.
   * A no-op while a save is running, without a template, or when the provider
   * withheld `save`.
   */
  requestSave: () => void;
  /**
   * The autosave path. Identical to {@link requestSave} except that a configured
   * gate is consulted with `runUnlessBlocked` instead of `tryRunSave`, so a
   * blocked autosave is skipped silently rather than raising a prompt while the
   * user is typing. The template stays dirty and the header keeps saying so.
   */
  requestAutoSave: () => void;
  /**
   * Commit an inline rename and persist it. Empty (or whitespace-only) names and
   * no-change commits are ignored, so a stray blur can neither clear the name
   * nor trigger a pointless round-trip.
   */
  rename: (name: string) => void;
  /** The loaded template's name, or `undefined` when unnamed / not loaded. */
  name: ComputedRef<string | undefined>;
  hasTemplate: ComputedRef<boolean>;
  isSaving: ComputedRef<boolean>;
  /**
   * What the header's status indicator shows. `"saved"` decays back to `"idle"`
   * after a few seconds; `"error"` stays until the next attempt, since a failure
   * the user never saw is worse than a stale badge.
   */
  status: Ref<"idle" | "saved" | "error">;
  /** The provider's own message for the last failure. Rendered in a tooltip. */
  errorMessage: Ref<string>;
  canCreate: ComputedRef<boolean>;
  canSave: ComputedRef<boolean>;
  isAvailable: ComputedRef<boolean>;
  capability: NonNullable<EditorCapabilities["templates"]>;
}

/**
 * Shared glue for the templates feature: the save-status the header renders, the
 * inline rename, the unsaved-changes guard, and the capability shared chrome
 * gates on.
 *
 * Persistence itself lives in `@templatical/core`'s `useEditor`, over the
 * consumer's {@link TemplatesProvider} — this composable owns only what is
 * *about the UI*. It is constructed exactly when a provider is configured, so
 * an editor without one downloads it but never runs it.
 */
export function useTemplatesFeature(
  options: UseTemplatesFeatureOptions,
): UseTemplatesFeatureReturn {
  const { provider, editor } = options;

  const status = ref<"idle" | "saved" | "error">("idle");
  const errorMessage = ref("");

  const { start: startSavedStatusClear, stop: stopSavedStatusClear } =
    useTimeoutFn(
      () => {
        status.value = "idle";
      },
      SAVED_STATUS_MS,
      { immediate: false },
    );

  const canCreate = computed(() => typeof provider.create === "function");
  const canSave = computed(() => typeof provider.save === "function");
  const isAvailable = computed(() => options.isAvailable?.() ?? true);

  const name = computed(() => editor.state.template?.name);
  const hasTemplate = computed(() => editor.state.template !== null);
  const isSaving = computed(() => editor.state.isSaving);

  function reportSuccess(): void {
    errorMessage.value = "";
    status.value = "saved";
    // Restart rather than stack: two saves inside the window would otherwise
    // clear the badge on the first timer, mid-way through the second's window.
    stopSavedStatusClear();
    startSavedStatusClear();
  }

  function reportFailure(error: unknown): void {
    stopSavedStatusClear();
    status.value = "error";
    errorMessage.value =
      error instanceof Error && error.message ? error.message : "Save failed";
  }

  async function save(): Promise<Template> {
    try {
      const template = await editor.save();
      reportSuccess();
      return template;
    } catch (error) {
      reportFailure(error);
      throw error;
    }
  }

  async function create(input?: {
    name?: string;
    content?: TemplateContent;
  }): Promise<Template> {
    try {
      const template = await editor.create(input);
      reportSuccess();
      return template;
    } catch (error) {
      reportFailure(error);
      throw error;
    }
  }

  function load(templateId: string): Promise<Template> {
    // Deliberately not wrapped: a failed *load* is not a failed save, and
    // flashing "Save failed" for it would be a lie. Core already routes it to
    // `onError` and rejects to the caller.
    return editor.load(templateId);
  }

  /**
   * An autosave tick that arrived while a save was in flight. `useAutoSave`'s
   * timer fires once and clears itself, and only a further content mutation
   * arms a new one — so dropping such a tick left autosave silent until the
   * user happened to type again.
   */
  let queuedAutoSave = false;

  /** Shared by both request paths — the outcome is reported through `status`. */
  function runSave(): Promise<void> {
    return save().then(
      () => {
        if (!queuedAutoSave) return;
        queuedAutoSave = false;
        // Only what the finished save could not have covered.
        if (editor.state.isDirty) requestAutoSave();
      },
      () => {
        // Deliberately no retry on failure: the status indicator already shows
        // "Save failed", so autosave has not gone *silent*, and re-firing into a
        // failing endpoint would only double the traffic. The next content
        // change arms a fresh tick.
        queuedAutoSave = false;
      },
    );
  }

  /** True when there is nothing a save could do, whatever the gate says. */
  function cannotSave(): boolean {
    // The UI hides the button in each of these cases; this covers Cmd+S and
    // programmatic callers, where a refusal would surface as an error badge for
    // something the user never asked for.
    return !canSave.value || !hasTemplate.value || isSaving.value;
  }

  function requestSave(): void {
    if (cannotSave()) return;
    const gate = options.getSaveGate?.();
    if (gate) {
      void gate.tryRunSave(runSave);
      return;
    }
    void runSave();
  }

  function requestAutoSave(): void {
    // Split the transient condition out of `cannotSave()`: a save already in
    // flight is a "later", not a "never". Overlapping PATCHes of the whole
    // document must still never happen, so the tick is queued rather than run.
    if (!canSave.value || !hasTemplate.value) return;
    if (isSaving.value) {
      queuedAutoSave = true;
      return;
    }
    const gate = options.getSaveGate?.();
    if (gate) {
      void gate.runUnlessBlocked(runSave);
      return;
    }
    void runSave();
  }

  function rename(newName: string): void {
    const trimmed = newName.trim();
    // An empty name is rejected rather than stored: the header would then have
    // nothing to render, and "" is far more likely a slip than an intent.
    if (!trimmed) return;
    if (trimmed === editor.state.template?.name) return;
    editor.setName(trimmed);
    requestSave();
  }

  // Tab close with unsaved work. Gated on a provider being configured — the
  // editor otherwise has no idea whether the consumer already persisted the
  // change, so it would be warning about nothing. Note this cannot cover SPA
  // route changes; `onDirtyChange` is what consumers guard their router with.
  if (options.guardUnsavedChanges !== false) {
    useEventListener(window, "beforeunload", (event: BeforeUnloadEvent) => {
      if (!editor.state.isDirty) return;
      event.preventDefault();
      // Some engines still show the prompt only when `returnValue` is set.
      event.returnValue = "";
    });
  }

  const capability: NonNullable<EditorCapabilities["templates"]> = {
    save: requestSave,
    rename,
    name,
    hasTemplate,
    isSaving,
    status,
    errorMessage,
    canCreate,
    canSave,
    isAvailable,
  };

  return {
    save,
    create,
    load,
    requestSave,
    requestAutoSave,
    rename,
    name,
    hasTemplate,
    isSaving,
    status,
    errorMessage,
    canCreate,
    canSave,
    isAvailable,
    capability,
  };
}
