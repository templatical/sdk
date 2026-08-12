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

export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const {
    content,
    isDirty,
    onChange,
    debounce = 1000,
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
