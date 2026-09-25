<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { Copy, X } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { usePlaygroundI18n } from "@/i18n";

const CodeEditor = defineAsyncComponent(() => import("@/CodeEditor.vue"));

const props = defineProps<{ snippet: string }>();
const emit = defineEmits<{ close: [] }>();

const { t } = usePlaygroundI18n();
const { copy, copied } = useClipboard({ copiedDuring: 1500 });
</script>

<template>
  <!-- A drawer under the editor, not a dialog over it: the snippet stays
       readable while the setup it builds is in use. .prevent marks the
       Escape it consumes, so the import paste panel doesn't close too. -->
  <section
    id="code-drawer"
    data-testid="code-drawer"
    :aria-label="t.host.snippet"
    class="pg-code-drawer"
    @keydown.escape.capture.prevent="emit('close')"
  >
    <div
      class="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-gray-200 pl-4 pr-2 dark:border-gray-700"
    >
      <h2
        class="m-0 text-[13px] font-semibold text-gray-900 dark:text-gray-100"
      >
        {{ t.host.snippet }}
      </h2>
      <div class="flex items-center gap-1">
        <button
          type="button"
          data-testid="code-drawer-copy"
          class="pg-toolbar-btn"
          @click="copy(props.snippet)"
        >
          <Copy :size="14" :stroke-width="1.75" aria-hidden="true" />
          {{ copied ? t.exportModal.copied : t.exportModal.copy }}
        </button>
        <button
          type="button"
          data-testid="code-drawer-close"
          class="pg-toolbar-icon-btn"
          :title="t.common.close"
          :aria-label="t.common.close"
          @click="emit('close')"
        >
          <X :size="16" :stroke-width="1.5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      <CodeEditor
        :model-value="props.snippet"
        language="javascript"
        read-only
        :aria-label="t.host.snippet"
      />
    </div>
  </section>
</template>
