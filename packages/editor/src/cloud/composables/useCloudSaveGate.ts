import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { PlanConfig } from "@templatical/types";
import type { LintIssue } from "../../composables/useTemplateLint";

export interface UseCloudSaveGateOptions {
  /** Reactive accessibility issues from `useTemplateLint`. */
  issues: Ref<LintIssue[]>;
  /** Reactive plan config from the server. */
  planConfig: Ref<PlanConfig | null>;
}

export interface UseCloudSaveGateReturn {
  /** True when the gate would block a save click given current state. */
  shouldBlock: ComputedRef<boolean>;
  /** Errors that would block the save. Empty when `shouldBlock` is false. */
  blockingIssues: ComputedRef<LintIssue[]>;
  /** Modal visibility — toggled by `tryRunSave` and `cancel`. */
  modalOpen: Ref<boolean>;
  /**
   * Wraps a save callback. Returns `true` when the save was invoked
   * (blocking disabled or no errors), `false` when the modal opened
   * instead. Caller can `await` the returned promise to know when the
   * save settled.
   */
  tryRunSave: (run: () => Promise<unknown> | unknown) => Promise<boolean>;
  /**
   * Runs the save only when the gate would not block, and does **nothing** when
   * it would — no modal, no save, nothing pending. Returns whether it ran.
   *
   * This is the autosave path. A modal on a debounce timer would interrupt
   * typing, but simply saving anyway would demote `blockOnError` from a server
   * policy to a manual-save-only speed bump. Skipping leaves the template dirty
   * and the header saying "unsaved", which is true, and the reason stays visible
   * in the Issues panel. The next edit re-arms the debounce, so fixing the issue
   * is what lets the save through — no retry timer needed.
   */
  runUnlessBlocked: (run: () => Promise<unknown> | unknown) => Promise<boolean>;
  /** Force-run the pending save, bypassing the gate. */
  confirmAndSave: () => Promise<void>;
  /** Dismiss the modal without saving. */
  cancel: () => void;
}

/**
 * Cloud-only save-gate. When `planConfig.accessibility.blockOnError === true`
 * and the linter reports any error-severity issues, intercept the save
 * click and surface a confirmation modal listing the blockers. The user
 * can dismiss to fix issues, or click "Save anyway" to bypass — the gate
 * does NOT enforce a hard block, it surfaces a deliberate choice.
 *
 * Server policy is the source of truth for `blockOnError`; consumer-side
 * `accessibility` options can't override it.
 */
export function useCloudSaveGate(
  opts: UseCloudSaveGateOptions,
): UseCloudSaveGateReturn {
  const modalOpen = ref(false);
  let pending: (() => Promise<unknown> | unknown) | null = null;

  const blockOnError = computed(
    () => opts.planConfig.value?.accessibility?.blockOnError === true,
  );

  const blockingIssues = computed(() =>
    blockOnError.value
      ? opts.issues.value.filter((i) => i.severity === "error")
      : [],
  );

  const shouldBlock = computed(() => blockingIssues.value.length > 0);

  async function tryRunSave(
    run: () => Promise<unknown> | unknown,
  ): Promise<boolean> {
    if (!shouldBlock.value) {
      await run();
      return true;
    }
    pending = run;
    modalOpen.value = true;
    return false;
  }

  async function runUnlessBlocked(
    run: () => Promise<unknown> | unknown,
  ): Promise<boolean> {
    if (shouldBlock.value) return false;
    await run();
    return true;
  }

  async function confirmAndSave(): Promise<void> {
    const run = pending;
    pending = null;
    modalOpen.value = false;
    if (run) {
      await run();
    }
  }

  function cancel(): void {
    pending = null;
    modalOpen.value = false;
  }

  return {
    shouldBlock,
    blockingIssues,
    modalOpen,
    tryRunSave,
    runUnlessBlocked,
    confirmAndSave,
    cancel,
  };
}
