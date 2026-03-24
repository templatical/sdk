<script setup lang="ts">
import { useI18n, useMergeTag } from '../../composables';
import type {
    VideoBlock as VideoBlockType,
    ViewportSize,
} from '@templatical/types';
import { getVideoThumbnail } from '../../utils/videoThumbnail';
import { containsMergeTag } from '@templatical/types';
import { Video } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
    block: VideoBlockType;
    viewport: ViewportSize;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();

const hasMergeTagUrl = computed(
    () =>
        containsMergeTag(props.block.url, syntax) ||
        containsMergeTag(props.block.thumbnailUrl, syntax),
);

const effectiveThumbnail = computed(() => {
    if (hasMergeTagUrl.value) return null;
    return getVideoThumbnail(props.block.url, props.block.thumbnailUrl);
});

const containerStyle = computed(() => ({
    textAlign: props.block.align,
}));

const thumbnailStyle = computed(() => ({
    maxWidth: '100%',
    width: props.block.width === 'full' ? '100%' : `${props.block.width}px`,
    display: 'block',
    margin: props.block.align === 'center' ? '0 auto' : undefined,
    marginLeft: props.block.align === 'right' ? 'auto' : undefined,
}));

const mergeTagLabel = computed(() => {
    if (containsMergeTag(props.block.url, syntax)) return props.block.url;
    return props.block.thumbnailUrl;
});
</script>

<template>
    <div class="tpl:w-full" :style="containerStyle">
        <!-- Placeholder with preview image provided -->
        <div
            v-if="hasMergeTagUrl && block.previewUrl"
            class="tpl:relative tpl:inline-block"
            :style="thumbnailStyle"
        >
            <img
                class="tpl:w-full tpl:border-0"
                :src="block.previewUrl"
                :alt="block.alt"
            />
            <div
                class="tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:bg-black/30"
            >
                <div
                    class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-white/90 tpl:shadow-lg"
                >
                    <svg
                        class="tpl:ml-1"
                        style="color: var(--tpl-danger)"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                </div>
            </div>
        </div>
        <!-- Placeholder visual (no preview image) -->
        <div
            v-else-if="hasMergeTagUrl"
            class="tpl:relative tpl:!flex tpl:min-h-[150px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-center"
            style="
                background-color: var(--tpl-bg-elevated);
                border-color: color-mix(
                    in srgb,
                    var(--tpl-primary) 40%,
                    transparent
                );
            "
            :style="thumbnailStyle"
        >
            <Video
                :size="36"
                :stroke-width="1.5"
                style="color: var(--tpl-primary); opacity: 0.5"
            />
            <span
                class="tpl:max-w-full tpl:truncate tpl:px-3 tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-primary); opacity: 0.7"
            >
                {{ mergeTagLabel }}
            </span>
        </div>
        <!-- Normal video thumbnail -->
        <template v-else-if="effectiveThumbnail">
            <a
                v-if="block.url"
                :href="block.url"
                target="_blank"
                rel="noopener noreferrer"
                class="tpl:group tpl:relative tpl:inline-block"
                :style="thumbnailStyle"
                @click.prevent
            >
                <img
                    class="tpl:w-full tpl:border-0"
                    :src="effectiveThumbnail"
                    :alt="block.alt"
                />
                <div
                    class="tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:bg-black/30 tpl:transition-opacity tpl:group-hover:bg-black/40"
                >
                    <div
                        class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-white/90 tpl:shadow-lg"
                    >
                        <svg
                            class="tpl:ml-1"
                            style="color: var(--tpl-danger)"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                    </div>
                </div>
            </a>
            <div
                v-else
                class="tpl:relative tpl:inline-block"
                :style="thumbnailStyle"
            >
                <img
                    class="tpl:w-full tpl:border-0"
                    :src="effectiveThumbnail"
                    :alt="block.alt"
                />
                <div
                    class="tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:bg-black/30"
                >
                    <div
                        class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-white/90 tpl:shadow-lg"
                    >
                        <svg
                            class="tpl:ml-1"
                            style="color: var(--tpl-danger)"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                    </div>
                </div>
            </div>
        </template>
        <!-- Empty state -->
        <div
            v-else
            class="tpl:flex tpl:min-h-[150px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-sm"
            style="
                border-color: var(--tpl-border-light);
                background-color: var(--tpl-bg-hover);
                color: var(--tpl-text-dim);
            "
        >
            <Video
                :size="40"
                :stroke-width="1.5"
                style="color: var(--tpl-border-light)"
            />
            <span>{{ t.video.addVideo }}</span>
        </div>
    </div>
</template>
