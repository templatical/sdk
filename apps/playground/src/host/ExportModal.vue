<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { useClipboard } from "@vueuse/core";
import { LoaderCircle } from "@lucide/vue";
import type { TemplaticalEditor } from "@templatical/editor";
import { getLastMjmlWarnings } from "@/host/providers";
import { useHostModal } from "@/host/useHostModal";
import { usePlaygroundI18n } from "@/i18n";

const CodeEditor = defineAsyncComponent(() => import("@/CodeEditor.vue"));

const props = defineProps<{
  editor: TemplaticalEditor | null;
}>();

const open = defineModel<boolean>("open", { required: true });

const { t } = usePlaygroundI18n();

type ExportTab = "mjml" | "html" | "json";
const exportTabs: readonly ExportTab[] = ["mjml", "html", "json"] as const;
const exportTab = ref<ExportTab>("mjml");
const exportJson = ref("");
const exportMjml = ref("");
const exportHtml = ref("");
const exportHtmlLoading = ref(false);
const exportHtmlError = ref("");
const exportHtmlMjmlErrors = ref<string[]>([]);

const dialogRef = useHostModal(open);
const { copy: copyExport, copied: exportCopied } = useClipboard({
  copiedDuring: 1500,
});

const exportTabValue = computed<string>(() => {
  if (exportTab.value === "html") return exportHtml.value;
  if (exportTab.value === "mjml") return exportMjml.value;
  return exportJson.value;
});

const exportFilename: Record<ExportTab, { name: string; mime: string }> = {
  html: { name: "email-template.html", mime: "text/html" },
  mjml: { name: "email-template.mjml", mime: "text/plain" },
  json: { name: "email-template.json", mime: "application/json" },
};

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function compileExportHtml(): Promise<void> {
  if (!props.editor || exportHtml.value || exportHtmlLoading.value) return;
  exportHtmlLoading.value = true;
  exportHtmlError.value = "";
  exportHtmlMjmlErrors.value = [];
  try {
    exportHtml.value = await props.editor.toHtml();
    exportHtmlMjmlErrors.value = [...getLastMjmlWarnings()];
  } catch (e) {
    exportHtmlError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exportHtmlLoading.value = false;
  }
}

function focusExportTab(delta: number): void {
  const idx = exportTabs.indexOf(exportTab.value);
  const next = (idx + delta + exportTabs.length) % exportTabs.length;
  exportTab.value = exportTabs[next];
  nextTick(() => {
    document.getElementById(`export-tab-${exportTabs[next]}`)?.focus();
  });
}

async function populate(): Promise<void> {
  if (!props.editor) return;
  exportTab.value = "mjml";
  exportHtml.value = "";
  exportHtmlError.value = "";
  exportHtmlMjmlErrors.value = [];
  exportJson.value = JSON.stringify(props.editor.getContent(), null, 2);
  exportMjml.value = await props.editor.toMjml();
  void compileExportHtml();
}

watch(open, (isOpen) => {
  if (isOpen) void populate();
});

watch(exportTab, (tab) => {
  if (tab === "html") void compileExportHtml();
});

function handleCopy(): void {
  copyExport(exportTabValue.value);
}

function handleDownload(): void {
  const { name, mime } = exportFilename[exportTab.value];
  downloadFile(exportTabValue.value, name, mime);
}

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
        @keydown.escape.capture="close"
      >
        <div
          ref="dialogRef"
          data-testid="export-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="t.exportModal.title"
          class="pg-modal-dialog w-[820px] max-w-[92vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
        >
          <div
            class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0 dark:border-gray-700"
          >
            <div
              role="tablist"
              :aria-label="t.exportModal.title"
              class="flex items-center gap-1"
              @keydown.arrow-right.prevent="focusExportTab(1)"
              @keydown.arrow-left.prevent="focusExportTab(-1)"
            >
              <button
                v-for="tab in exportTabs"
                :id="`export-tab-${tab}`"
                :key="tab"
                type="button"
                role="tab"
                :aria-selected="exportTab === tab"
                :aria-controls="`export-panel-${tab}`"
                :tabindex="exportTab === tab ? 0 : -1"
                :data-testid="`export-tab-${tab}`"
                class="pg-tab h-8 px-3 text-[13px]"
                :class="
                  exportTab === tab
                    ? 'pg-tab-active'
                    : 'pg-tab-inactive text-gray-500 dark:text-gray-400'
                "
                @click="exportTab = tab"
              >
                {{ t.exportModal.tabs[tab] }}
              </button>
            </div>
            <button
              type="button"
              :aria-label="t.common.close"
              class="pg-modal-close"
              data-testid="export-modal-close"
              @click="close"
            >
              &times;
            </button>
          </div>

          <div
            :id="`export-panel-${exportTab}`"
            role="tabpanel"
            :aria-labelledby="`export-tab-${exportTab}`"
            class="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3"
          >
            <p class="text-[12px] text-gray-500 dark:text-gray-400 m-0">
              {{ t.exportModal.description[exportTab] }}
            </p>

            <div
              v-if="exportTab === 'html' && exportHtmlLoading"
              role="status"
              class="flex items-center gap-2 justify-center text-sm text-gray-500 h-[min(480px,60vh)] border border-gray-200 rounded-lg dark:text-gray-400 dark:border-gray-700"
            >
              <LoaderCircle
                class="animate-spin h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <span>{{ t.exportModal.compiling }}</span>
            </div>

            <div
              v-else-if="exportTab === 'html' && exportHtmlError"
              data-testid="export-html-error"
              class="flex flex-col items-center justify-center gap-3 h-[min(480px,60vh)] border border-gray-200 rounded-lg dark:border-gray-700"
            >
              <p class="m-0 text-sm text-gray-500 dark:text-gray-400">
                {{ t.exportModal.compileError }}
              </p>
              <p
                class="m-0 max-w-full text-[11px] font-mono text-gray-400 break-words dark:text-gray-500"
              >
                {{ exportHtmlError }}
              </p>
              <button
                type="button"
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                @click="compileExportHtml"
              >
                {{ t.exportModal.retry }}
              </button>
            </div>

            <CodeEditor
              v-else
              :model-value="exportTabValue"
              :aria-label="t.exportModal.title"
            />

            <div
              v-if="
                exportTab === 'html' &&
                !exportHtmlError &&
                exportHtmlMjmlErrors.length
              "
              class="border border-gray-200 rounded-md p-3 dark:border-gray-700"
            >
              <p
                class="m-0 mb-1 text-[11px] font-semibold text-gray-600 dark:text-gray-400"
              >
                {{ t.exportModal.compileErrorDetails }}
              </p>
              <ul
                class="m-0 pl-4 text-[11px] font-mono text-gray-500 list-disc dark:text-gray-400"
              >
                <li v-for="(msg, i) in exportHtmlMjmlErrors" :key="i">
                  {{ msg }}
                </li>
              </ul>
            </div>
          </div>

          <div
            class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 shrink-0 dark:border-gray-700"
          >
            <button
              type="button"
              data-testid="export-copy"
              class="pg-cancel-btn"
              :disabled="!exportTabValue || exportHtmlLoading"
              @click="handleCopy"
            >
              <span aria-live="polite">{{
                exportCopied ? t.exportModal.copied : t.exportModal.copy
              }}</span>
            </button>
            <button
              type="button"
              data-testid="export-download"
              class="pg-cta h-9 px-4 text-[13px] rounded-md"
              :disabled="!exportTabValue || exportHtmlLoading"
              @click="handleDownload"
            >
              {{ t.exportModal.download }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
