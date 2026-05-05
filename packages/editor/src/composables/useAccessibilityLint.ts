import { ref, shallowRef, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
// Type-only import — runtime is dynamically loaded.
import type {
  A11yIssue,
  A11yOptions,
  lintAccessibility as LintFn,
} from "@templatical/quality";

export type { A11yIssue, A11yOptions } from "@templatical/quality";

export interface UseAccessibilityLintOptions {
  content: Ref<TemplateContent>;
  options: A11yOptions;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  /** Debounce in ms; defaults to 500 to match the plan. */
  debounce?: number;
}

export interface UseAccessibilityLintReturn {
  issues: Ref<A11yIssue[]>;
  /** True once the quality package has been successfully imported. */
  ready: Ref<boolean>;
  /** True if the dynamic import failed (e.g. package not installed). */
  unavailable: Ref<boolean>;
  applyFix: (issue: A11yIssue) => void;
  destroy: () => void;
}

/**
 * Live accessibility linting. Lazy-imports `@templatical/quality` on first
 * call so the OSS bundle pays nothing for the chunk until the user opens
 * the panel. Re-lints debounced (500ms default) on every content change.
 *
 * When `options.disabled === true`, the dynamic import is skipped entirely
 * and `issues` stays empty — saves the chunk download for consumers that
 * turn off the linter.
 */
export function useAccessibilityLint(
  opts: UseAccessibilityLintOptions,
): UseAccessibilityLintReturn {
  const issues = ref<A11yIssue[]>([]) as Ref<A11yIssue[]>;
  const ready = ref(false);
  const unavailable = ref(false);
  const lintFn = shallowRef<typeof LintFn | null>(null);

  const disabled = opts.options.disabled === true;

  let stopWatch: (() => void) | null = null;

  if (!disabled) {
    void load();
  }

  async function load(): Promise<void> {
    try {
      const mod = await import("@templatical/quality");
      lintFn.value = mod.lintAccessibility;
      ready.value = true;
      runLint();
      stopWatch = watchDebounced(opts.content, runLint, {
        debounce: opts.debounce ?? 500,
        deep: true,
      });
    } catch {
      // The quality package is an optional peer; surface the unavailable
      // flag so consumers can hide UI rather than crash.
      unavailable.value = true;
    }
  }

  function runLint(): void {
    if (!lintFn.value) return;
    issues.value = lintFn.value(opts.content.value, opts.options);
  }

  // Re-run when severity overrides change at runtime (rare, but useful for
  // cloud plan-config merges).
  const stopOptionsWatch = watch(
    () => opts.options,
    () => {
      if (lintFn.value) runLint();
    },
    { deep: true },
  );

  function applyFix(issue: A11yIssue): void {
    if (!issue.fix) return;
    issue.fix.apply({
      updateBlock: opts.updateBlock,
      updateSettings: opts.updateSettings,
    });
    // The content watcher will re-lint via the debounced watcher.
  }

  function destroy(): void {
    stopWatch?.();
    stopOptionsWatch();
  }

  return { issues, ready, unavailable, applyFix, destroy };
}
