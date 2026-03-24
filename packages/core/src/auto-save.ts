import type { TemplateContent } from '@templatical/types';
import { watch, type Ref } from '@vue/reactivity';

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
        return typeof enabled === 'function' ? enabled() : enabled;
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
            if (isDirty()) {
                onChange(JSON.parse(JSON.stringify(content.value)));
            }
        }, debounce);
    }

    const stopWatch = watch(
        content,
        () => {
            if (isEnabled() && !paused && isDirty()) {
                scheduleOnChange();
            }
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
