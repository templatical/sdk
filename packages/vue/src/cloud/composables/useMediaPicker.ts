import type { UsePlanConfigReturn } from '@templatical/core/cloud';
import type { MediaItem } from '@templatical/types';
import type { MediaRequestContext } from '@templatical/types';
import { computed, inject, ref, type ComputedRef, type Ref } from 'vue';

export interface UseMediaPickerReturn {
    isPluggableMediaEnabled: ComputedRef<boolean>;
    isRequesting: Ref<boolean>;
    requestMedia: (context?: MediaRequestContext) => Promise<MediaItem | null>;
}

export function useMediaPicker(): UseMediaPickerReturn {
    const onRequestMedia = inject<
        | ((context: MediaRequestContext) => Promise<MediaItem | null>)
        | undefined
    >('onRequestMedia');
    const planConfig = inject<UsePlanConfigReturn>('planConfig')!;

    const isRequesting = ref(false);

    const isPluggableMediaEnabled = computed(
        () => !!onRequestMedia && planConfig.hasFeature('pluggable_media'),
    );

    async function requestMedia(
        context?: MediaRequestContext,
    ): Promise<MediaItem | null> {
        if (!onRequestMedia) {
            return null;
        }

        isRequesting.value = true;
        try {
            return await onRequestMedia(context ?? {});
        } finally {
            isRequesting.value = false;
        }
    }

    return { isPluggableMediaEnabled, isRequesting, requestMedia };
}
