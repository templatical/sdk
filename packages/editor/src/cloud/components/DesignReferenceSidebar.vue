<script setup lang="ts">
import { MAX_UPLOAD_SIZE_BYTES } from "../../constants/timeouts";
import LoadingTrack from "../../components/LoadingTrack.vue";
import { useDesignReference } from "@templatical/core/cloud";
import { EDITOR_KEY, AUTH_MANAGER_KEY } from "../../keys";
import { useI18n } from "../../composables/useI18n";
import type { TemplateContent } from "@templatical/types";
import {
  CircleAlert,
  FileImage,
  FileText,
  ImageUp,
  Upload,
  X,
} from "@lucide/vue";
import { computed, inject, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  hasExistingBlocks: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply", content: TemplateContent): void;
}>();

const { t } = useI18n();
const editor = inject(EDITOR_KEY)!;
const authManager = inject(AUTH_MANAGER_KEY)!;

const designReference = useDesignReference({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
  onApply: (content) => emit("apply", content),
});

const fileInput = ref<HTMLInputElement | null>(null);

type SourceTab = "image" | "pdf";

const activeTab = ref<SourceTab>("image");
const selectedFile = ref<File | null>(null);
const prompt = ref("");
const filePreviewUrl = ref<string | null>(null);
const showConfirmation = ref(false);
const isDragging = ref(false);

const canGenerate = computed(() => {
  if (designReference.isGenerating.value) {
    return false;
  }

  return selectedFile.value !== null;
});

function selectTab(tab: SourceTab): void {
  activeTab.value = tab;
  clearFile();
}

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    setFile(file);
  }
  // Reset input so same file can be selected again
  input.value = "";
}

function setFile(file: File): void {
  // Validate file size (10MB)
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    designReference.error.value = t.designReference.fileTooLarge;
    return;
  }

  // Validate file type
  if (activeTab.value === "image") {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      designReference.error.value = t.designReference.invalidFileType;
      return;
    }
  } else if (activeTab.value === "pdf") {
    if (file.type !== "application/pdf") {
      designReference.error.value = t.designReference.invalidFileType;
      return;
    }
  }

  selectedFile.value = file;
  designReference.error.value = null;

  // Create preview URL for images
  if (filePreviewUrl.value) {
    URL.revokeObjectURL(filePreviewUrl.value);
  }
  if (file.type.startsWith("image/")) {
    filePreviewUrl.value = URL.createObjectURL(file);
  } else {
    filePreviewUrl.value = null;
  }
}

function clearFile(): void {
  if (filePreviewUrl.value) {
    URL.revokeObjectURL(filePreviewUrl.value);
    filePreviewUrl.value = null;
  }
  selectedFile.value = null;
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(): void {
  isDragging.value = false;
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;

  const file = event.dataTransfer?.files?.[0];
  if (file) {
    setFile(file);
  }
}

function handleGenerate(): void {
  if (!canGenerate.value) {
    return;
  }

  // Show confirmation if there are existing blocks
  if (props.hasExistingBlocks && !showConfirmation.value) {
    showConfirmation.value = true;
    return;
  }

  showConfirmation.value = false;

  const input: {
    prompt?: string;
    imageUpload?: File;
    pdfUpload?: File;
  } = {};

  if (prompt.value.trim()) {
    input.prompt = prompt.value.trim();
  }

  if (activeTab.value === "image" && selectedFile.value) {
    input.imageUpload = selectedFile.value;
  } else if (activeTab.value === "pdf" && selectedFile.value) {
    input.pdfUpload = selectedFile.value;
  }

  designReference.generate(input);
}

function cancelConfirmation(): void {
  showConfirmation.value = false;
}

// Reset state when panel closes
watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      showConfirmation.value = false;
    }
  },
);
</script>

<template>
  <Transition
    enter-active-class="tpl-design-slide-enter-active"
    enter-from-class="tpl:translate-x-full"
    enter-to-class="tpl:translate-x-0"
    leave-active-class="tpl-design-slide-leave-active"
    leave-from-class="tpl:translate-x-0"
    leave-to-class="tpl:translate-x-full"
  >
    <div
      v-if="visible"
      class="tpl-design-sidebar tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:z-panel tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-primary)]"
        >
          <ImageUp :size="13" :stroke-width="2" />
          <span>{{ t.designReference.title }}</span>
        </div>
        <button
          class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150 tpl:text-[var(--tpl-text-muted)]"
          @click="emit('close')"
        >
          <X :size="14" :stroke-width="2" />
        </button>
      </div>

      <!-- Content -->
      <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
        <!-- Loading state -->
        <div
          v-if="designReference.isGenerating.value"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <div
            class="tpl:flex tpl:w-full tpl:flex-col tpl:items-center tpl:gap-3"
          >
            <LoadingTrack />
            <p class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
              {{ t.designReference.generating }}
            </p>
          </div>
        </div>

        <!-- Input form -->
        <div v-else class="tpl:flex tpl:flex-col tpl:gap-4">
          <!-- Source tabs -->
          <div
            class="tpl:flex tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1 tpl:bg-[var(--tpl-bg-hover)]"
          >
            <button
              class="tpl:flex tpl:flex-1 tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-2 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              :style="{
                backgroundColor:
                  activeTab === 'image' ? 'var(--tpl-bg)' : 'transparent',
                color:
                  activeTab === 'image'
                    ? 'var(--tpl-primary)'
                    : 'var(--tpl-text-muted)',
                boxShadow: activeTab === 'image' ? 'var(--tpl-shadow)' : 'none',
              }"
              @click="selectTab('image')"
            >
              <FileImage :size="12" :stroke-width="2" />
              {{ t.designReference.uploadImage }}
            </button>
            <button
              class="tpl:flex tpl:flex-1 tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-2 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              :style="{
                backgroundColor:
                  activeTab === 'pdf' ? 'var(--tpl-bg)' : 'transparent',
                color:
                  activeTab === 'pdf'
                    ? 'var(--tpl-primary)'
                    : 'var(--tpl-text-muted)',
                boxShadow: activeTab === 'pdf' ? 'var(--tpl-shadow)' : 'none',
              }"
              @click="selectTab('pdf')"
            >
              <FileText :size="12" :stroke-width="2" />
              {{ t.designReference.uploadPdf }}
            </button>
          </div>

          <!-- File upload area (image or pdf) -->
          <div>
            <!-- Preview -->
            <div v-if="selectedFile" class="tpl:flex tpl:flex-col tpl:gap-2">
              <div
                class="tpl:relative tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
              >
                <!-- Image preview -->
                <img
                  v-if="filePreviewUrl"
                  :src="filePreviewUrl"
                  :alt="selectedFile.name"
                  class="tpl:h-auto tpl:max-h-48 tpl:w-full tpl:object-contain"
                />
                <!-- PDF preview (icon-based) -->
                <div
                  v-else
                  class="tpl:flex tpl:h-32 tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2"
                >
                  <FileText
                    :size="32"
                    :stroke-width="1.5"
                    class="tpl:text-[var(--tpl-text-dim)]"
                  />
                  <span class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">
                    {{ selectedFile.name }}
                  </span>
                </div>
                <!-- Remove button -->
                <button
                  class="tpl:absolute tpl:top-2 tpl:right-2 tpl:rounded-full tpl:p-1 tpl:transition-colors tpl:duration-150 tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:shadow-[var(--tpl-shadow)]"
                  @click="clearFile"
                >
                  <X :size="12" :stroke-width="2" />
                </button>
              </div>
            </div>

            <!-- Drop zone -->
            <div
              v-else
              class="tpl-design-dropzone tpl:flex tpl:cursor-pointer tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border-2 tpl:border-dashed tpl:px-4 tpl:py-8 tpl:transition-colors tpl:duration-150"
              :style="{
                borderColor: isDragging
                  ? 'var(--tpl-primary)'
                  : 'var(--tpl-border-light)',
                backgroundColor: isDragging
                  ? 'var(--tpl-primary-light)'
                  : 'var(--tpl-bg)',
              }"
              @click="fileInput?.click()"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <Upload
                :size="24"
                :stroke-width="1.5"
                class="tpl:text-[var(--tpl-text-dim)]"
              />
              <span
                class="tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
              >
                {{ t.designReference.dropHint }}
              </span>
              <span
                class="tpl:text-center tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
              >
                {{
                  activeTab === "image"
                    ? t.designReference.acceptedImages
                    : t.designReference.acceptedPdf
                }}
              </span>
            </div>
            <input
              ref="fileInput"
              type="file"
              class="tpl:hidden"
              :accept="
                activeTab === 'image'
                  ? 'image/png,image/jpeg,image/webp'
                  : 'application/pdf'
              "
              @change="handleFileSelect"
            />
          </div>

          <!-- Prompt textarea -->
          <div class="tpl:flex tpl:flex-col tpl:gap-1.5">
            <label
              class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            >
              {{ t.designReference.promptLabel }}
            </label>
            <textarea
              v-model="prompt"
              class="tpl:min-h-[72px] tpl:w-full tpl:resize-none tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3 tpl:py-2 tpl:font-sans tpl:text-sm tpl:outline-none tpl:transition-colors tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
              :class="['tpl-design-prompt-input']"
              :placeholder="t.designReference.promptPlaceholder"
              rows="3"
            />
          </div>

          <!-- Confirmation overlay -->
          <div
            v-if="showConfirmation"
            class="tpl:flex tpl:flex-col tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:px-3 tpl:py-3 tpl:bg-[var(--tpl-warning-light)] tpl:border tpl:border-[var(--tpl-warning)]"
          >
            <p class="tpl:text-xs tpl:leading-snug tpl:text-[var(--tpl-text)]">
              {{ t.designReference.replaceWarning }}
            </p>
            <div class="tpl:flex tpl:gap-2">
              <button
                class="tpl:flex-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:text-[var(--tpl-text-muted)] tpl:border tpl:border-[var(--tpl-border)]"
                style="background-color: transparent"
                @click="cancelConfirmation"
              >
                {{ t.designReference.replaceCancel }}
              </button>
              <button
                class="tpl:flex-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
                @click="handleGenerate"
              >
                {{ t.designReference.replaceConfirm }}
              </button>
            </div>
          </div>

          <!-- Error message -->
          <div
            v-if="designReference.error.value"
            class="tpl:flex tpl:items-start tpl:gap-2 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
          >
            <CircleAlert
              :size="14"
              :stroke-width="2"
              class="tpl:mt-0.5 tpl:shrink-0"
            />
            <span>{{ t.designReference.error }}</span>
          </div>

          <!-- Generate button -->
          <button
            v-if="!showConfirmation"
            class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
            :disabled="!canGenerate"
            @click="handleGenerate"
          >
            <ImageUp :size="16" :stroke-width="2" />
            {{ t.designReference.generate }}
          </button>

          <!-- AI disclaimer -->
          <p
            class="tpl:m-0 tpl:pt-1 tpl:text-center tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
          >
            {{ t.aiMenu.disclaimer }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tpl-design-slide-enter-active {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-design-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-design-prompt-input:focus {
  border-color: var(--tpl-primary);
  box-shadow: var(--tpl-ring);
}

.tpl-design-dropzone:hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
