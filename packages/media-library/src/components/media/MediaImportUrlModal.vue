<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { Loader2 } from "lucide-vue-next";
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  isImporting: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: "import", url: string): void;
  (e: "close"): void;
}>();

const { t } = useI18n();

const urlValue = ref("");

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      urlValue.value = "";
    }
  },
);

function handleImport(): void {
  const trimmedUrl = urlValue.value.trim();
  if (!trimmedUrl || props.isImporting) {
    return;
  }

  emit("import", trimmedUrl);
}

function handleClose(): void {
  if (!props.isImporting) {
    emit("close");
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    handleImport();
  }
  if (event.key === "Escape") {
    handleClose();
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
        v-if="visible"
        class="tpl tpl:fixed tpl:inset-0 tpl:z-[10000] tpl:flex tpl:items-center tpl:justify-center"
        style="background-color: var(--tpl-overlay)"
        @click.self="handleClose"
        @keydown="handleKeydown"
      >
        <div
          class="tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-lg tpl:p-5 tpl:shadow-xl"
          style="background-color: var(--tpl-bg-elevated)"
        >
          <h3
            class="tpl:mb-4 tpl:text-sm tpl:font-semibold"
            style="color: var(--tpl-text)"
          >
            {{ t.mediaLibrary.importFromUrl }}
          </h3>

          <!-- URL Input -->
          <div class="tpl:mb-3">
            <input
              v-model="urlValue"
              type="url"
              class="tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:outline-none"
              style="
                border-color: var(--tpl-border);
                background-color: var(--tpl-bg);
                color: var(--tpl-text);
              "
              :placeholder="t.mediaLibrary.importUrlPlaceholder"
              :disabled="isImporting"
              autofocus
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
              :disabled="isImporting"
              :class="{
                'tpl:cursor-not-allowed tpl:opacity-50': isImporting,
              }"
              @click="handleClose"
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
              :disabled="!urlValue.trim() || isImporting"
              @click="handleImport"
            >
              <span
                v-if="isImporting"
                class="tpl:flex tpl:items-center tpl:gap-1.5"
              >
                <Loader2
                  class="tpl:animate-spin"
                  :size="12"
                  :stroke-width="2"
                />
                {{ t.mediaLibrary.importing }}
              </span>
              <span v-else>
                {{ t.mediaLibrary.import }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
