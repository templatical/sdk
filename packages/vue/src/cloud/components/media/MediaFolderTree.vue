<script setup lang="ts">
import MediaFolderTreeNode from './MediaFolderTreeNode.vue';
import { useI18n, type MediaViewMode } from '../../../composables';
import type { MediaFolder } from '@templatical/types';
import { File, Plus, Star } from 'lucide-vue-next';
import { ref } from 'vue';

defineProps<{
    folders: MediaFolder[];
    currentFolderId: string | null;
    viewMode: MediaViewMode;
    hasFrequentlyUsed: boolean;
}>();

const emit = defineEmits<{
    (e: 'navigate', folderId: string | null): void;
    (e: 'createFolder', name: string, parentId?: string | null): void;
    (e: 'renameFolder', folderId: string, name: string): void;
    (e: 'deleteFolder', folderId: string): void;
    (e: 'showFrequentlyUsed'): void;
}>();

const { t } = useI18n();

const isCreating = ref(false);
const newFolderName = ref('');

function startCreateFolder(): void {
    isCreating.value = true;
    newFolderName.value = '';
}

function confirmCreateFolder(): void {
    if (newFolderName.value.trim()) {
        emit('createFolder', newFolderName.value.trim());
    }
    isCreating.value = false;
    newFolderName.value = '';
}

function cancelCreate(): void {
    isCreating.value = false;
    newFolderName.value = '';
}
</script>

<template>
    <div class="tpl:flex tpl:h-full tpl:flex-col tpl:overflow-y-auto">
        <!-- All Images root -->
        <button
            class="tpl:flex tpl:w-full tpl:items-center tpl:gap-2 tpl:px-3 tpl:py-2 tpl:text-left tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
            :style="{
                backgroundColor:
                    viewMode === 'files' && currentFolderId === null
                        ? 'var(--tpl-bg-active)'
                        : 'transparent',
                color:
                    viewMode === 'files' && currentFolderId === null
                        ? 'var(--tpl-primary)'
                        : 'var(--tpl-text)',
            }"
            @click="emit('navigate', null)"
        >
            <File :size="14" :stroke-width="1.5" />
            {{ t.mediaLibrary.allFiles }}
        </button>

        <!-- Recursive folder tree -->
        <MediaFolderTreeNode
            v-for="folder in folders"
            :key="folder.id"
            :folder="folder"
            :current-folder-id="currentFolderId"
            :depth="0"
            @navigate="emit('navigate', $event)"
            @create-folder="
                (name, parentId) => emit('createFolder', name, parentId)
            "
            @rename-folder="(id, name) => emit('renameFolder', id, name)"
            @delete-folder="emit('deleteFolder', $event)"
        />

        <!-- New folder input -->
        <div v-if="isCreating" class="tpl:px-3 tpl:py-2">
            <input
                v-model="newFolderName"
                type="text"
                class="tpl:w-full tpl:rounded tpl:border tpl:px-2 tpl:py-1 tpl:text-xs tpl:outline-none"
                style="
                    border-color: var(--tpl-primary);
                    background-color: var(--tpl-bg);
                    color: var(--tpl-text);
                "
                :placeholder="t.mediaLibrary.folderName"
                autofocus
                @keydown.enter="confirmCreateFolder"
                @keydown.escape="cancelCreate"
                @blur="confirmCreateFolder"
            />
        </div>

        <!-- New folder button -->
        <button
            v-if="!isCreating"
            class="tpl:flex tpl:w-full tpl:items-center tpl:gap-2 tpl:px-3 tpl:py-2 tpl:text-left tpl:text-xs tpl:transition-all tpl:duration-150"
            style="color: var(--tpl-text-muted)"
            @click="startCreateFolder"
        >
            <Plus :size="14" :stroke-width="1.5" />
            {{ t.mediaLibrary.newFolder }}
        </button>

        <!-- Spacer to push frequently used to bottom -->
        <div class="tpl:flex-1" />

        <!-- Frequently Used -->
        <button
            v-if="hasFrequentlyUsed"
            class="tpl:flex tpl:w-full tpl:items-center tpl:gap-2 tpl:border-t tpl:px-3 tpl:py-2 tpl:text-left tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
            :style="{
                borderColor: 'var(--tpl-border)',
                backgroundColor:
                    viewMode === 'frequently-used'
                        ? 'var(--tpl-bg-active)'
                        : 'transparent',
                color:
                    viewMode === 'frequently-used'
                        ? 'var(--tpl-primary)'
                        : 'var(--tpl-text)',
            }"
            @click="emit('showFrequentlyUsed')"
        >
            <Star :size="14" :stroke-width="1.5" />
            {{ t.mediaLibrary.frequentlyUsed }}
        </button>
    </div>
</template>
