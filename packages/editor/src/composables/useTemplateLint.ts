import { ref, shallowRef, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
// Type-only import — runtime is dynamically loaded.
import type {
  LintIssue,
  LintOptions,
  lintAccessibility as LintAccessibilityFn,
  lintStructure as LintStructureFn,
  lintLinks as LintLinksFn,
} from "@templatical/quality";

export type { LintIssue, LintOptions } from "@templatical/quality";

/**
 * Mirrors `isLintFullyDisabled` from `@templatical/quality`. Duplicated
 * here to avoid a static runtime import of the optional peer, which would
 * defeat the editor's lazy-load gate. Keep the two in sync.
 */
export function isLintFullyDisabled(options: LintOptions | undefined): boolean {
  if (!options) return false;
  if (options.disabled === true) return true;
  return (
    options.accessibility === false &&
    options.structure === false &&
    options.links === false
  );
}

export interface UseTemplateLintOptions {
  content: Ref<TemplateContent>;
  options: LintOptions;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  removeBlock: (blockId: string) => void;
  /** Debounce in ms; defaults to 500 to match the plan. */
  debounce?: number;
}

export interface UseTemplateLintReturn {
  issues: Ref<LintIssue[]>;
  /** True once the quality package has been successfully imported. */
  ready: Ref<boolean>;
  /** True if the dynamic import failed (e.g. package not installed). */
  unavailable: Ref<boolean>;
  applyFix: (issue: LintIssue) => void;
  destroy: () => void;
}

interface Loaded {
  lintAccessibility: typeof LintAccessibilityFn;
  lintStructure: typeof LintStructureFn;
  lintLinks: typeof LintLinksFn;
}

/**
 * Live template linting. Runs every linter in `@templatical/quality`
 * (accessibility + structure + links) on every content change,
 * debounced 500ms. Lazy-imports the quality package on first call so the
 * OSS bundle pays nothing for the chunk until linting actually starts.
 *
 * When all linting is turned off — either `options.disabled === true` or
 * every per-tool key (`accessibility`, `structure`, `links`) is set to
 * `false` — the dynamic import is skipped entirely and `issues` stays
 * empty. Saves the chunk download for consumers that turn the linter off.
 */
export function useTemplateLint(
  opts: UseTemplateLintOptions,
): UseTemplateLintReturn {
  const issues = ref<LintIssue[]>([]) as Ref<LintIssue[]>;
  const ready = ref(false);
  const unavailable = ref(false);
  const loaded = shallowRef<Loaded | null>(null);

  const disabled = isLintFullyDisabled(opts.options);

  let stopWatch: (() => void) | null = null;
  let destroyed = false;

  if (!disabled) {
    void load();
  }

  async function load(): Promise<void> {
    try {
      const mod = await import("@templatical/quality");
      // Bail if the consumer destroyed us during the dynamic import — both
      // to avoid mutating dead refs and to avoid leaking a watcher that
      // destroy() can no longer reach.
      if (destroyed) return;
      loaded.value = {
        lintAccessibility: mod.lintAccessibility,
        lintStructure: mod.lintStructure,
        lintLinks: mod.lintLinks,
      };
      ready.value = true;
      runLint();
      stopWatch = watchDebounced(opts.content, runLint, {
        debounce: opts.debounce ?? 500,
        deep: true,
      });
    } catch {
      if (destroyed) return;
      // The quality package is an optional peer; surface the unavailable
      // flag so consumers can hide UI rather than crash.
      unavailable.value = true;
    }
  }

  function runLint(): void {
    if (!loaded.value) return;
    const a11y = loaded.value.lintAccessibility(
      opts.content.value,
      opts.options,
    );
    const structure = loaded.value.lintStructure(
      opts.content.value,
      opts.options,
    );
    const links = loaded.value.lintLinks(opts.content.value, opts.options);
    issues.value = [...a11y, ...structure, ...links];
  }

  // Re-run when severity overrides change at runtime (rare, but useful for
  // cloud plan-config merges).
  const stopOptionsWatch = watch(
    () => opts.options,
    () => {
      if (loaded.value) runLint();
    },
    { deep: true },
  );

  function applyFix(issue: LintIssue): void {
    if (!issue.fix) return;
    issue.fix.apply({
      updateBlock: opts.updateBlock,
      updateSettings: opts.updateSettings,
      removeBlock: opts.removeBlock,
    });
    // The content watcher will re-lint via the debounced watcher.
  }

  function destroy(): void {
    destroyed = true;
    stopWatch?.();
    stopOptionsWatch();
  }

  return { issues, ready, unavailable, applyFix, destroy };
}
