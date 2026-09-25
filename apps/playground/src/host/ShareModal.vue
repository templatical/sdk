<script setup lang="ts">
import { ref, watch } from "vue";
import { useClipboard } from "@vueuse/core";
import { LoaderCircle } from "@lucide/vue";
import type { TemplaticalEditor } from "@templatical/editor";
import { createShare } from "@/host/share";
import { useHostModal } from "@/host/useHostModal";
import { usePlaygroundI18n } from "@/i18n";

const props = defineProps<{
  editor: TemplaticalEditor | null;
  sceneId: string;
}>();

const open = defineModel<boolean>("open", { required: true });

const { t } = usePlaygroundI18n();
const dialogRef = useHostModal(open);
const shareUrl = ref("");
const shareLoading = ref(false);
const shareError = ref("");
const {
  copy: copyShareUrl,
  copied: shareCopied,
  isSupported: clipboardSupported,
} = useClipboard({ copiedDuring: 1500 });

async function createLink(): Promise<void> {
  if (!props.editor) return;
  shareLoading.value = true;
  shareError.value = "";
  shareUrl.value = "";
  try {
    const data = await createShare(props.editor.getContent(), props.sceneId);
    shareUrl.value = data.url;
  } catch (e) {
    shareError.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    shareLoading.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) void createLink();
});

function close(): void {
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pg-modal">
      <div
        v-if="open"
        class="pg-modal-backdrop"
        @click.self="close"
        @keydown.escape.capture.prevent="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          class="pg-modal-dialog w-[440px] max-w-[90vw] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
          >
            <span
              id="share-modal-title"
              class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >{{ t.shareModal.title }}</span
            >
            <button
              type="button"
              :aria-label="t.common.close"
              class="pg-modal-close"
              @click="close"
            >
              &times;
            </button>
          </div>
          <div class="px-5 py-5">
            <div
              v-if="shareLoading"
              role="status"
              class="flex flex-col items-center gap-3 py-4"
            >
              <LoaderCircle
                class="animate-spin h-5 w-5 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">{{
                t.shareModal.loading
              }}</span>
            </div>
            <div
              v-else-if="shareError"
              class="flex flex-col items-center gap-3 py-4"
            >
              <p class="m-0 text-sm text-gray-500 dark:text-gray-400">
                {{ t.shareModal.error }}
              </p>
              <button
                type="button"
                class="h-8 px-4 bg-gray-900 text-white text-xs font-medium font-sans rounded-md border-none cursor-pointer transition-colors duration-150 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                @click="createLink"
              >
                {{ t.shareModal.retry }}
              </button>
            </div>
            <div v-else class="flex flex-col gap-3">
              <p class="m-0 text-[13px] text-gray-500 dark:text-gray-400">
                {{ t.shareModal.description }}
              </p>
              <div class="flex gap-2">
                <input
                  :value="shareUrl"
                  readonly
                  :aria-label="t.shareModal.copyLink"
                  class="flex-1 h-9 px-3 text-[13px] font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <button
                  v-if="clipboardSupported"
                  type="button"
                  class="h-9 px-4 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium font-sans cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                  @click="copyShareUrl(shareUrl)"
                >
                  {{
                    shareCopied ? t.shareModal.copied : t.shareModal.copyLink
                  }}
                </button>
              </div>
              <p class="m-0 text-[11px] text-gray-400 dark:text-gray-500">
                {{ t.shareModal.expiry }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
