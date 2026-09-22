<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useClipboard } from "@vueuse/core";
import { useHostModal } from "@/host/useHostModal";
import { usePlaygroundI18n } from "@/i18n";

const CodeEditor = defineAsyncComponent(() => import("@/CodeEditor.vue"));

const props = defineProps<{
  snippet: string;
  docs: string;
}>();

const open = defineModel<boolean>("open", { required: true });

const { t } = usePlaygroundI18n();
const dialogRef = useHostModal(open);
const { copy, copied } = useClipboard({ copiedDuring: 1500 });

function close(): void {
  open.value = false;
}

function handleCopy(): void {
  copy(props.snippet);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pg-modal">
      <div
        v-if="open"
        class="pg-modal-backdrop"
        @click.self="close"
        @keydown.escape.capture="close"
      >
        <div
          ref="dialogRef"
          data-testid="code-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="code-dialog-title"
          class="pg-modal-dialog w-[820px] max-w-[92vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
          >
            <span
              id="code-dialog-title"
              class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >{{ t.host.snippet }}</span
            >
            <button
              type="button"
              data-testid="code-dialog-close"
              :aria-label="t.common.close"
              class="pg-modal-close"
              @click="close"
            >
              &times;
            </button>
          </div>
          <div class="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
            <CodeEditor
              :model-value="snippet"
              language="javascript"
              read-only
              :aria-label="t.host.snippet"
            />
            <div class="flex items-center justify-between gap-3">
              <a
                :href="'https://docs.templatical.com' + docs"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-gray-600 no-underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                >{{ t.host.docs }}</a
              >
              <button
                type="button"
                data-testid="code-dialog-copy"
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                @click="handleCopy"
              >
                {{ copied ? t.exportModal.copied : t.exportModal.copy }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
