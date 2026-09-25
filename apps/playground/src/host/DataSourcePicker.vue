<script setup lang="ts">
import { computed, ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { ChevronRight, LoaderCircle } from "@lucide/vue";
import { useHostModal } from "@/host/useHostModal";
import { usePlaygroundI18n } from "@/i18n";
import {
  registerDataSourcePicker,
  resolveDataSourcePicker,
  type DataSourcePickerItem,
  type DataSourcePickerRequest,
} from "@/templates";

const { t } = usePlaygroundI18n();

const open = ref(false);
const request = ref<DataSourcePickerRequest | null>(null);
const fetching = ref(true);
const { start: startFetchTimer, stop: stopFetchTimer } = useTimeoutFn(
  () => {
    fetching.value = false;
  },
  3000,
  { immediate: false },
);

const isOpen = computed(() => open.value && !!request.value);
const dialogRef = useHostModal(isOpen);

registerDataSourcePicker((next: DataSourcePickerRequest) => {
  request.value = next;
  fetching.value = true;
  open.value = true;
  stopFetchTimer();
  startFetchTimer();
});

function selectItem(item: DataSourcePickerItem): void {
  stopFetchTimer();
  open.value = false;
  resolveDataSourcePicker(item);
}

function cancel(): void {
  stopFetchTimer();
  open.value = false;
  resolveDataSourcePicker(null);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pg-modal">
      <div
        v-if="open && request"
        class="pg-modal-backdrop"
        @click.self="cancel"
        @keydown.escape.capture.prevent="cancel"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="datasource-modal-title"
          class="pg-modal-dialog w-[500px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
          >
            <span
              id="datasource-modal-title"
              class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >{{ request.title }}</span
            >
            <button
              type="button"
              :aria-label="t.common.close"
              class="pg-modal-close"
              @click="cancel"
            >
              &times;
            </button>
          </div>
          <div
            v-if="fetching"
            role="status"
            class="flex flex-col items-center justify-center gap-4 py-12 px-5"
          >
            <LoaderCircle
              class="h-6 w-6 animate-spin text-primary"
              aria-hidden="true"
            />
            <div class="text-center space-y-2">
              <p class="m-0 text-sm text-gray-500 dark:text-gray-400">
                {{ t.dataSourceModal.fetching }}
              </p>
              <code
                class="block text-[11px] text-gray-400 font-mono bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-w-full break-all dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >{{ request.endpoint }}</code
              >
              <p
                class="m-0 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-xs mx-auto"
              >
                {{ t.dataSourceModal.fetchDescription }}
              </p>
            </div>
          </div>
          <div v-else class="flex-1 overflow-auto p-3 space-y-2">
            <p
              class="m-0 px-2 pb-1 text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.5px] font-medium"
            >
              {{ t.dataSourceModal.responseReceived }}
            </p>
            <button
              v-for="item in request.items"
              :key="item.id"
              type="button"
              class="group flex w-full items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white cursor-pointer transition-all duration-150 text-left font-sans hover:border-primary hover:shadow-primary-ring-subtle dark:bg-gray-700 dark:border-gray-600"
              @click="selectItem(item)"
            >
              <img
                v-if="item.thumbnail"
                :src="item.thumbnail"
                :alt="item.label"
                class="shrink-0 size-12 rounded-md object-cover border border-gray-100 dark:border-gray-600"
              />
              <div class="min-w-0 flex-1">
                <div
                  class="text-[13px] font-semibold text-gray-900 group-hover:text-primary transition-colors duration-150 dark:text-gray-100"
                >
                  {{ item.label }}
                </div>
                <p
                  class="m-0 mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate"
                >
                  {{ item.description }}
                </p>
              </div>
              <ChevronRight
                class="shrink-0 text-gray-300 group-hover:text-primary transition-colors duration-150"
                :size="16"
                :stroke-width="1.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
