import type { TemplateContent } from "@templatical/types";
import { watch, type Ref } from "@vue/reactivity";

export interface UseAutoSaveOptions {
  content: Ref<TemplateContent>;
  isDirty: () => boolean;
  onChange: (content: TemplateContent) => void;
  debounce?: number;
  enabled?: boolean | (() => boolean);
}

export interface UseAutoSaveReturn {
  flush: () => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

/**
 * Trailing debounce, in ms, measured from the *last* content mutation.
 *
 * Typing is not debounced upstream — TipTap's `onUpdate` calls `updateBlock` per
 * keystroke — so this is the only thing between a keypress and a whole-document
 * write. 1000 was too eager: ordinary prose pauses for a second constantly
 * (word choice, re-reading, reaching for the mouse), so a single paragraph could
 * produce dozens of full-content saves. 2000 roughly halves that while still
 * landing well before a user wonders whether their work was kept.
 */
const DEFAULT_DEBOUNCE_MS = 2000;

export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const {
    content,
    isDirty,
    onChange,
    debounce = DEFAULT_DEBOUNCE_MS,
    enabled = true,
  } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  function isEnabled(): boolean {
    return typeof enabled === "function" ? enabled() : enabled;
  }

  function pause(): void {
    paused = true;
    cancel();
  }

  function resume(): void {
    paused = false;
  }

  function cancel(): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function flush(): void {
    cancel();
    if (isDirty()) {
      onChange(JSON.parse(JSON.stringify(content.value)));
    }
  }

  function scheduleOnChange(): void {
    if (!isEnabled() || paused) return;

    cancel();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (isEnabled() && !paused && isDirty()) {
        onChange(JSON.parse(JSON.stringify(content.value)));
      }
    }, debounce);
  }

  // `watch` from `@vue/reactivity` has no scheduler, so this callback runs
  // *synchronously inside the mutation* — before the editor's trailing
  // `state.isDirty = true`, and `isDirty` sits outside the watched `content`
  // subtree so setting it never re-triggers. An `isDirty()` guard here would
  // therefore drop the first edit after every dirty-flag reset (issue #522).
  // Dirtiness is decided at debounce time instead, where the flag is settled;
  // `scheduleOnChange` still checks `enabled`/`paused` up front.
  const stopWatch = watch(
    content,
    () => {
      scheduleOnChange();
    },
    { deep: true },
  );

  function destroy(): void {
    stopWatch();
    cancel();
  }

  return {
    flush,
    cancel,
    pause,
    resume,
    destroy,
  };
}
