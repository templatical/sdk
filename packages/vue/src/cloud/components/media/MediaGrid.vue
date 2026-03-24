<script setup lang="ts">
import MediaFileIcon from './MediaFileIcon.vue';
import { useI18n } from '../../../composables';
import { useMediaCategories } from '../../composables/useMediaCategories';
import type {
    MediaCategory,
    MediaItem,
} from '@templatical/types';
import { useIntersectionObserver } from '@vueuse/core';
import { Check, File, Loader2, Pencil, RefreshCw } from 'lucide-vue-next';
import { ref } from 'vue';

const props = defineProps<{
    items: MediaItem[];
    selectedIds: Set<string>;
    isLoading: boolean;
    hasMore: boolean;
    accept?: MediaCategory[];
    layout?: 'grid' | 'list';
}>();

const emit = defineEmits<{
    (e: 'select', item: MediaItem): void;
    (e: 'toggle', id: string): void;
    (e: 'loadMore'): void;
    (e: 'edit', item: MediaItem): void;
    (e: 'replace', item: MediaItem): void;
}>();

const { isAcceptedMimeType, isImageMimeType } = useMediaCategories();

function isSelectable(item: MediaItem): boolean {
    if (!props.accept || props.accept.length === 0) {
        return true;
    }

    return isAcceptedMimeType(item.mime_type, props.accept);
}

function handleItemClick(item: MediaItem): void {
    emit('select', item);
}

const { t } = useI18n();

const sentinelRef = ref<HTMLElement | null>(null);

useIntersectionObserver(
    sentinelRef,
    ([{ isIntersecting }]) => {
        if (isIntersecting && props.hasMore && !props.isLoading) {
            emit('loadMore');
        }
    },
    { threshold: 0.1 },
);

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
</script>

<template>
    <div class="tpl:p-4">
        <!-- Skeleton loading -->
        <div
            v-if="isLoading && items.length === 0"
            :class="
                layout === 'list'
                    ? 'tpl:flex tpl:flex-col tpl:gap-1'
                    : 'tpl:grid tpl:grid-cols-4 tpl:gap-3'
            "
        >
            <div
                v-for="i in 8"
                :key="i"
                class="tpl-pulse tpl:rounded-lg"
                :class="layout === 'list' ? 'tpl:h-12' : 'tpl:aspect-square'"
                style="background-color: var(--tpl-bg-hover)"
            />
        </div>

        <!-- Empty state -->
        <div
            v-else-if="items.length === 0"
            class="tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:py-16"
        >
            <File
                class="tpl:mb-3"
                :size="40"
                :stroke-width="1"
                style="color: var(--tpl-text-dim)"
            />
            <p class="tpl:text-xs" style="color: var(--tpl-text-muted)">
                {{ t.mediaLibrary.noFiles }}
            </p>
        </div>

        <!-- Grid -->
        <div
            v-else-if="layout !== 'list'"
            class="tpl:grid tpl:grid-cols-4 tpl:gap-3"
        >
            <div
                v-for="item in items"
                :key="item.id"
                class="tpl-media-item tpl:group tpl:relative tpl:overflow-hidden tpl:rounded-lg tpl:border-2 tpl:transition-all tpl:duration-150"
                :class="[
                    'tpl:cursor-pointer',
                    !isSelectable(item) && !selectedIds.has(item.id)
                        ? 'tpl:opacity-60'
                        : '',
                    selectedIds.has(item.id) ? 'tpl-media-item--selected' : '',
                ]"
                :style="{
                    borderColor: selectedIds.has(item.id)
                        ? 'var(--tpl-primary)'
                        : 'transparent',
                    backgroundColor:
                        !isSelectable(item) && !selectedIds.has(item.id)
                            ? 'var(--tpl-bg)'
                            : 'var(--tpl-bg-hover)',
                }"
                @click="handleItemClick(item)"
            >
                <div class="tpl:aspect-square">
                    <img
                        v-if="isImageMimeType(item.mime_type)"
                        :src="item.small_url || item.url"
                        :alt="item.filename"
                        class="tpl:size-full tpl:object-cover"
                        loading="lazy"
                    />
                    <MediaFileIcon v-else :mime-type="item.mime_type" />
                </div>
                <div class="tpl:px-2 tpl:py-1.5">
                    <p
                        class="tpl:truncate tpl:text-[10px] tpl:font-medium"
                        style="color: var(--tpl-text)"
                    >
                        {{ item.filename }}
                    </p>
                    <p
                        class="tpl:flex tpl:justify-between tpl:text-[9px]"
                        style="color: var(--tpl-text-muted)"
                    >
                        <span>{{ formatSize(item.size) }}</span>
                        <span
                            v-if="
                                isImageMimeType(item.mime_type) &&
                                item.width &&
                                item.height
                            "
                        >
                            {{ item.width }}&times;{{ item.height }}
                        </span>
                    </p>
                </div>
                <!-- Action buttons -->
                <div
                    class="tpl:absolute tpl:top-1.5 tpl:left-1.5 tpl:flex tpl:gap-1 tpl:opacity-0 tpl:transition-opacity tpl:duration-150 tpl:group-hover:opacity-100"
                >
                    <!-- Edit button -->
                    <button
                        class="tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-white"
                        style="background-color: rgba(0, 0, 0, 0.6)"
                        :title="t.mediaLibrary.editFile"
                        @click.stop="emit('edit', item)"
                    >
                        <Pencil :size="11" :stroke-width="2" />
                    </button>
                    <!-- Replace button -->
                    <button
                        class="tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-white"
                        style="background-color: rgba(0, 0, 0, 0.6)"
                        :title="t.mediaLibrary.replaceFile"
                        @click.stop="emit('replace', item)"
                    >
                        <RefreshCw :size="11" :stroke-width="2" />
                    </button>
                </div>
                <!-- Selection check -->
                <div
                    v-if="selectedIds.has(item.id)"
                    class="tpl:absolute tpl:top-1.5 tpl:right-1.5 tpl:flex tpl:size-5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-white"
                    style="background-color: var(--tpl-primary)"
                >
                    <Check :size="12" :stroke-width="3" />
                </div>
            </div>
        </div>

        <!-- List -->
        <div v-else class="tpl:flex tpl:flex-col tpl:gap-1">
            <div
                v-for="item in items"
                :key="item.id"
                class="tpl-media-list-item tpl:group tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-3 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:transition-all tpl:duration-150"
                :class="[
                    !isSelectable(item) && !selectedIds.has(item.id)
                        ? 'tpl:opacity-60'
                        : '',
                ]"
                :style="{
                    backgroundColor: selectedIds.has(item.id)
                        ? 'var(--tpl-bg-hover)'
                        : 'transparent',
                }"
                @click="handleItemClick(item)"
            >
                <!-- Thumbnail -->
                <div
                    class="tpl:size-10 tpl:shrink-0 tpl:overflow-hidden tpl:rounded"
                    style="background-color: var(--tpl-bg-hover)"
                >
                    <img
                        v-if="isImageMimeType(item.mime_type)"
                        :src="item.small_url || item.url"
                        :alt="item.filename"
                        class="tpl:size-full tpl:object-cover"
                        loading="lazy"
                    />
                    <div v-else class="tpl-list-icon tpl:size-full">
                        <MediaFileIcon :mime-type="item.mime_type" />
                    </div>
                </div>

                <!-- Info -->
                <div class="tpl:min-w-0 tpl:flex-1">
                    <p
                        class="tpl:truncate tpl:text-xs tpl:font-medium"
                        style="color: var(--tpl-text)"
                    >
                        {{ item.filename }}
                    </p>
                    <p
                        class="tpl:text-[10px]"
                        style="color: var(--tpl-text-muted)"
                    >
                        {{ formatSize(item.size) }} &middot;
                        {{ formatDate(item.created_at) }}
                        <template
                            v-if="
                                isImageMimeType(item.mime_type) &&
                                item.width &&
                                item.height
                            "
                        >
                            &middot;
                            {{ item.width }}&times;{{ item.height }}
                        </template>
                    </p>
                </div>

                <!-- Action buttons -->
                <div
                    class="tpl:flex tpl:gap-1 tpl:opacity-0 tpl:transition-opacity tpl:duration-150 tpl:group-hover:opacity-100"
                >
                    <!-- Edit button -->
                    <button
                        class="tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded"
                        style="color: var(--tpl-text-muted)"
                        :title="t.mediaLibrary.editFile"
                        @click.stop="emit('edit', item)"
                    >
                        <Pencil :size="12" :stroke-width="2" />
                    </button>
                    <!-- Replace button -->
                    <button
                        class="tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded"
                        style="color: var(--tpl-text-muted)"
                        :title="t.mediaLibrary.replaceFile"
                        @click.stop="emit('replace', item)"
                    >
                        <RefreshCw :size="12" :stroke-width="2" />
                    </button>
                </div>

                <!-- Selection check -->
                <div
                    v-if="selectedIds.has(item.id)"
                    class="tpl:flex tpl:size-5 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-white"
                    style="background-color: var(--tpl-primary)"
                >
                    <Check :size="12" :stroke-width="3" />
                </div>
            </div>
        </div>

        <!-- Infinite scroll sentinel -->
        <div ref="sentinelRef" class="tpl:h-4" />

        <!-- Loading more indicator -->
        <div
            v-if="isLoading && items.length > 0"
            class="tpl:flex tpl:justify-center tpl:py-4"
        >
            <Loader2
                class="tpl-spinner"
                :size="20"
                :stroke-width="2"
                style="color: var(--tpl-primary)"
            />
        </div>
    </div>
</template>

<style scoped>
.tpl-media-item:not(.tpl-media-item--selected):hover {
    border-color: var(--tpl-border) !important;
}

.tpl-media-list-item:hover {
    background-color: var(--tpl-bg-hover) !important;
}

.tpl-list-icon {
    transform: scale(0.35);
    transform-origin: center;
}
</style>
