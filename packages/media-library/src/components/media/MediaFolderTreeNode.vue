<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { MediaFolder } from "../../types";
import { ChevronRight, Folder, Pencil, Plus, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  folder: MediaFolder;
  currentFolderId: string | null;
  depth: number;
}>();

const emit = defineEmits<{
  (e: "navigate", folderId: string | null): void;
  (e: "createFolder", name: string, parentId?: string | null): void;
  (e: "renameFolder", folderId: string, name: string): void;
  (e: "deleteFolder", folderId: string): void;
}>();

const { t } = useI18n();

const isExpanded = ref(false);
const isRenaming = ref(false);
const renameValue = ref("");
const isCreatingSubfolder = ref(false);
const subfolderName = ref("");

const MAX_DEPTH = 5;

const hasChildren = computed(() => (props.folder.children?.length ?? 0) > 0);

const canCreateSubfolder = computed(() => props.depth < MAX_DEPTH - 1);

const isActive = computed(() => props.currentFolderId === props.folder.id);

const isDescendantActive = computed(() => {
  if (!props.currentFolderId || !props.folder.children) return false;
  return containsFolder(props.folder.children, props.currentFolderId);
});

const shouldExpand = computed(
  () => isExpanded.value || isDescendantActive.value,
);

function containsFolder(folders: MediaFolder[], id: string): boolean {
  for (const folder of folders) {
    if (folder.id === id) return true;
    if (folder.children && containsFolder(folder.children, id)) return true;
  }
  return false;
}

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value;
}

function startRename(): void {
  isRenaming.value = true;
  renameValue.value = props.folder.name;
}

function confirmRename(): void {
  const trimmed = renameValue.value.trim();
  if (trimmed && trimmed !== props.folder.name) {
    emit("renameFolder", props.folder.id, trimmed);
  }
  isRenaming.value = false;
  renameValue.value = "";
}

function cancelRename(): void {
  isRenaming.value = false;
  renameValue.value = "";
}

function startCreateSubfolder(): void {
  isCreatingSubfolder.value = true;
  subfolderName.value = "";
  isExpanded.value = true;
}

function confirmCreateSubfolder(): void {
  if (subfolderName.value.trim()) {
    emit("createFolder", subfolderName.value.trim(), props.folder.id);
  }
  isCreatingSubfolder.value = false;
  subfolderName.value = "";
}

function cancelCreateSubfolder(): void {
  isCreatingSubfolder.value = false;
  subfolderName.value = "";
}
</script>

<template>
  <div>
    <!-- Folder row -->
    <div
      class="tpl:group tpl:flex tpl:w-full tpl:items-center tpl:gap-1 tpl:py-1.5 tpl:pr-2 tpl:text-left tpl:text-xs tpl:transition-all tpl:duration-150"
      :style="{
        paddingLeft: `${depth * 16 + 8}px`,
        backgroundColor: isActive ? 'var(--tpl-bg-active)' : 'transparent',
        color: isActive ? 'var(--tpl-primary)' : 'var(--tpl-text)',
      }"
    >
      <!-- Expand/collapse chevron -->
      <button
        v-if="hasChildren || isCreatingSubfolder"
        class="tpl:flex tpl:size-4 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded tpl:transition-colors"
        @click.stop="toggleExpand"
      >
        <ChevronRight
          class="tpl:transition-transform tpl:duration-150"
          :class="{ 'tpl:rotate-90': shouldExpand }"
          :size="10"
          :stroke-width="2"
        />
      </button>
      <span v-else class="tpl:size-4 tpl:shrink-0" />

      <!-- Folder icon + name (clickable) -->
      <button
        class="tpl:flex tpl:min-w-0 tpl:flex-1 tpl:items-center tpl:gap-1.5"
        @click="emit('navigate', folder.id)"
      >
        <Folder class="tpl:shrink-0" :size="14" :stroke-width="1.5" />
        <template v-if="!isRenaming">
          <span class="tpl:truncate">{{ folder.name }}</span>
        </template>
      </button>

      <!-- Inline rename input -->
      <input
        v-if="isRenaming"
        v-model="renameValue"
        type="text"
        class="tpl:min-w-0 tpl:flex-1 tpl:rounded tpl:border tpl:px-1.5 tpl:py-0.5 tpl:text-xs tpl:outline-none"
        style="
          border-color: var(--tpl-primary);
          background-color: var(--tpl-bg);
          color: var(--tpl-text);
        "
        autofocus
        @keydown.enter="confirmRename"
        @keydown.escape="cancelRename"
        @blur="confirmRename"
        @click.stop
      />

      <!-- Hover actions -->
      <span
        v-if="!isRenaming"
        class="tpl:flex tpl:shrink-0 tpl:items-center tpl:gap-0.5 tpl:opacity-0 tpl:transition-opacity tpl:group-hover:opacity-100"
      >
        <!-- Add subfolder -->
        <button
          v-if="canCreateSubfolder"
          class="tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded tpl:transition-colors"
          :title="t.mediaLibrary.addSubfolder"
          @click.stop="startCreateSubfolder"
        >
          <Plus :size="12" :stroke-width="2" />
        </button>
        <!-- Rename -->
        <button
          class="tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded tpl:transition-colors"
          :title="t.mediaLibrary.renameFolder"
          @click.stop="startRename"
        >
          <Pencil :size="12" :stroke-width="2" />
        </button>
        <!-- Delete -->
        <button
          class="tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded tpl:transition-colors"
          @click.stop="emit('deleteFolder', folder.id)"
        >
          <Trash2
            :size="12"
            :stroke-width="2"
            style="color: var(--tpl-danger)"
          />
        </button>
      </span>
    </div>

    <!-- Children (expanded) -->
    <div v-if="shouldExpand">
      <MediaFolderTreeNode
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :current-folder-id="currentFolderId"
        :depth="depth + 1"
        @navigate="emit('navigate', $event)"
        @create-folder="
          (name, parentId) => emit('createFolder', name, parentId)
        "
        @rename-folder="(id, name) => emit('renameFolder', id, name)"
        @delete-folder="emit('deleteFolder', $event)"
      />

      <!-- Subfolder creation input -->
      <div
        v-if="isCreatingSubfolder"
        :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
        class="tpl:py-1.5 tpl:pr-2"
      >
        <input
          v-model="subfolderName"
          type="text"
          class="tpl:w-full tpl:rounded tpl:border tpl:px-2 tpl:py-1 tpl:text-xs tpl:outline-none"
          style="
            border-color: var(--tpl-primary);
            background-color: var(--tpl-bg);
            color: var(--tpl-text);
          "
          :placeholder="t.mediaLibrary.subfolderName"
          autofocus
          @keydown.enter="confirmCreateSubfolder"
          @keydown.escape="cancelCreateSubfolder"
          @blur="confirmCreateSubfolder"
        />
      </div>
    </div>
  </div>
</template>
