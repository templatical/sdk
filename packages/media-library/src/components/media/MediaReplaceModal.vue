<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { MediaItem, MediaUsageInfo } from "../../types";
import { computed, inject, ref, watch, type Ref } from "vue";

const props = defineProps<{
  visible: boolean;
  item: MediaItem | null;
  usageInfo: MediaUsageInfo | null;
  isReplacing: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: "replace", file: File): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const tplUiTheme = inject<Ref<"light" | "dark">>("tplUiTheme");

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);

const extension = computed(() => {
  if (!props.item) {
    return "";
  }

  const parts = props.item.filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
});

const acceptPattern = computed(() => {
  return extension.value ? `.${extension.value}` : "*";
});

const hasUsage = computed(() => {
  return (props.usageInfo?.template_count ?? 0) > 0;
});

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      selectedFile.value = null;
      if (fileInputRef.value) {
        fileInputRef.value.value = "";
      }
    }
  },
);

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    selectedFile.value = input.files[0];
  }
}

function handleReplace(): void {
  if (selectedFile.value) {
    emit("replace", selectedFile.value);
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="tpl:transition tpl:ease-out tpl:duration-150"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:ease-in tpl:duration-100"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <div
        v-if="visible && item"
        :data-tpl-theme="tplUiTheme"
        class="tpl tpl:fixed tpl:inset-0 tpl:z-[10000] tpl:flex tpl:items-center tpl:justify-center"
        style="background-color: var(--tpl-overlay)"
        @click.self="emit('close')"
        @keydown="handleKeydown"
      >
        <div
          class="tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-lg tpl:p-5 tpl:shadow-xl"
          style="background-color: var(--tpl-bg-elevated)"
        >
          <h3
            class="tpl:mb-2 tpl:text-sm tpl:font-semibold"
            style="color: var(--tpl-text)"
          >
            {{ t.mediaLibrary.replaceWarningTitle }}
          </h3>

          <!-- Warning message -->
          <p class="tpl:mb-2 tpl:text-xs" style="color: var(--tpl-text-muted)">
            {{
              t.mediaLibrary.replaceWarningMessage.replace(
                "{extension}",
                `.${extension}`,
              )
            }}
          </p>

          <!-- Usage warning -->
          <p
            v-if="hasUsage"
            class="tpl:mb-3 tpl:text-xs"
            style="color: var(--tpl-warning)"
          >
            {{
              t.mediaLibrary.replaceWarningUsageNote.replace(
                "{count}",
                usageInfo!.template_count.toString(),
              )
            }}
          </p>

          <!-- Current file info -->
          <div
            class="tpl:mb-3 tpl:rounded tpl:border tpl:p-2"
            style="border-color: var(--tpl-border)"
          >
            <p
              class="tpl:truncate tpl:text-xs tpl:font-medium"
              style="color: var(--tpl-text)"
            >
              {{ item.filename }}
            </p>
          </div>

          <!-- File input -->
          <div class="tpl:mb-4">
            <label
              class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
              style="color: var(--tpl-text-muted)"
            >
              {{ t.mediaLibrary.replaceSelectFile }}
            </label>
            <input
              ref="fileInputRef"
              type="file"
              :accept="acceptPattern"
              class="tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs"
              style="
                border-color: var(--tpl-border);
                background-color: var(--tpl-bg);
                color: var(--tpl-text);
              "
              @change="handleFileChange"
            />
          </div>

          <!-- Error message -->
          <p
            v-if="error"
            class="tpl:mb-3 tpl:text-xs"
            style="color: var(--tpl-danger)"
          >
            {{ error }}
          </p>

          <!-- Actions -->
          <div class="tpl:flex tpl:justify-end tpl:gap-2">
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-text);
                background-color: var(--tpl-bg);
              "
              :disabled="isReplacing"
              @click="emit('close')"
            >
              {{ t.mediaLibrary.cancel }}
            </button>
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-white tpl:transition-all tpl:duration-150 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
              style="
                background: linear-gradient(
                  135deg,
                  var(--tpl-primary),
                  var(--tpl-primary-hover)
                );
              "
              :disabled="!selectedFile || isReplacing"
              @click="handleReplace"
            >
              {{
                isReplacing ? t.mediaLibrary.replacing : t.mediaLibrary.replace
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
