<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Upload } from "@lucide/vue";
import { useFileDialog } from "@vueuse/core";
import type { TemplaticalEditor } from "@templatical/editor";
import { convertImportSource } from "@/host/importConvert";
import { usePlaygroundI18n } from "@/i18n";
import {
  IMPORT_KIND_BY_ID,
  type ImportKind,
  type ImportSceneId,
} from "@/scenes/import/shared";

const props = defineProps<{
  sceneId: string;
  editor: TemplaticalEditor | null;
}>();

const { t } = usePlaygroundI18n();
const source = ref("");
const error = ref("");
const open = ref(true);
const converting = ref(false);

const kind = computed((): ImportKind | undefined => {
  const id = props.sceneId as ImportSceneId;
  return IMPORT_KIND_BY_ID[id];
});

watch(
  () => props.sceneId,
  () => {
    source.value = "";
    error.value = "";
    open.value = true;
    converting.value = false;
  },
);

const TEXTAREA_TESTID: Record<ImportKind, string> = {
  unlayer: "import-textarea-unlayer",
  beefree: "import-textarea-beefree",
  html: "import-textarea-html",
  mjml: "import-textarea-mjml",
  topol: "import-textarea-topol",
  stripo: "import-textarea-stripo",
  chamaileon: "import-textarea-chamaileon",
  "easy-email-pro": "import-textarea-easy-email-pro",
};

const PLACEHOLDER: Record<ImportKind, string> = {
  unlayer: '{"body": {"rows": [...], "values": {...}}}',
  beefree: '{"page": {"body": {...}, "rows": [...]}}',
  html: "<!doctype html>\n<html>\n  <body>\n    <table>...</table>\n  </body>\n</html>",
  mjml: "<mjml>\n  <mj-body>\n    <mj-section>...</mj-section>\n  </mj-body>\n</mjml>",
  topol:
    '{"tagName": "mj-global-style", "children": [{"tagName": "mj-container", "children": [...]}]}',
  stripo: '<table class="es-wrapper">...</table>',
  chamaileon:
    '{"body": {"type": "body", "children": [{"type": "fullwidth", "children": [...]}]}}',
  "easy-email-pro":
    '{"subject": "...", "content": {"type": "page", "children": [{"type": "standard-section", "children": [...]}]}}',
};

function copyFor(current: ImportKind) {
  const modal = t.value.importModal;
  const a11y = t.value.a11y;
  switch (current) {
    case "unlayer":
      return {
        description: modal.unlayer.description,
        emptyError: modal.unlayer.emptyError,
        ariaLabel: a11y.unlayerJsonContent,
      };
    case "beefree":
      return {
        description: modal.beefree.description,
        emptyError: modal.beefree.emptyError,
        ariaLabel: a11y.beefreeJsonContent,
      };
    case "html":
      return {
        description: modal.html.description,
        emptyError: modal.html.emptyError,
        ariaLabel: a11y.htmlSourceContent,
      };
    case "mjml":
      return {
        description: modal.mjml.description,
        emptyError: modal.mjml.emptyError,
        ariaLabel: a11y.mjmlSourceContent,
      };
    case "topol":
      return {
        description: modal.topol.description,
        emptyError: modal.topol.emptyError,
        ariaLabel: a11y.topolSourceContent,
      };
    case "stripo":
      return {
        description: modal.stripo.description,
        emptyError: modal.stripo.emptyError,
        ariaLabel: a11y.stripoSourceContent,
      };
    case "chamaileon":
      return {
        description: modal.chamaileon.description,
        emptyError: modal.chamaileon.emptyError,
        ariaLabel: a11y.chamaileonSourceContent,
      };
    case "easy-email-pro":
      return {
        description: modal.easyEmailPro.description,
        emptyError: modal.easyEmailPro.emptyError,
        ariaLabel: a11y.easyEmailProSourceContent,
      };
  }
}

const copy = computed(() => (kind.value ? copyFor(kind.value) : null));

function dismiss(): void {
  open.value = false;
  error.value = "";
}

function onKeydown(event: KeyboardEvent): void {
  // A host dialog opened over the panel (Code, Export, Share) closes on the
  // same Escape and marks it handled; that press must not also dismiss the
  // panel and discard what was pasted.
  if (event.defaultPrevented) return;
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    dismiss();
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});

async function runConvert(): Promise<void> {
  const current = kind.value;
  if (!current || !copy.value) return;
  const raw = source.value.trim();
  if (!raw) {
    error.value = copy.value.emptyError;
    return;
  }
  if (!props.editor) return;
  error.value = "";
  converting.value = true;
  try {
    const content = await convertImportSource(current, raw);
    props.editor.setContent(content);
    open.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    converting.value = false;
  }
}

const { open: openImportFile, onChange: onImportFileChange } = useFileDialog({
  accept: ".json,.html,.htm,.mjml",
  multiple: false,
});

onImportFileChange(async (files) => {
  const file = files?.[0];
  if (!file) return;
  source.value = await file.text();
  await runConvert();
});
</script>

<template>
  <div
    v-if="open && kind && copy"
    class="absolute inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/40 p-4 pointer-events-none"
  >
    <div
      data-testid="import-panel"
      role="dialog"
      aria-labelledby="import-panel-title"
      class="pointer-events-auto flex w-full max-w-[40rem] max-h-full flex-col gap-3 overflow-auto rounded-xl border border-gray-200 bg-white p-5 shadow-modal dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p
            id="import-panel-title"
            class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            {{ t.importModal.title }}
          </p>
          <p class="m-0 mt-1 text-xs text-gray-600 dark:text-gray-300">
            {{ copy.description }}
          </p>
        </div>
        <button
          type="button"
          class="pg-modal-close"
          :aria-label="t.common.close"
          data-testid="import-close"
          @click="dismiss"
        >
          &times;
        </button>
      </div>
      <button
        type="button"
        class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-transparent py-5 text-gray-600 transition-[border-color,color] duration-150 hover:border-primary hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:text-gray-100"
        @click="() => openImportFile()"
      >
        <Upload :size="20" :stroke-width="1.5" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t.importModal.chooseFile }}</span>
      </button>
      <div
        class="flex items-center gap-4 text-xs uppercase tracking-[0.5px] text-gray-600 before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200 dark:text-gray-400 before:dark:bg-gray-700 after:dark:bg-gray-700"
      >
        <span>{{ t.importModal.orPaste }}</span>
      </div>
      <textarea
        v-model="source"
        :aria-label="copy.ariaLabel"
        :data-testid="TEXTAREA_TESTID[kind]"
        :placeholder="PLACEHOLDER[kind]"
        class="pg-input h-[10rem] resize-y p-4 font-mono text-xs leading-relaxed bg-gray-50 placeholder:text-gray-500 dark:bg-gray-700/50"
      />
      <p
        v-if="error"
        data-testid="import-error"
        class="m-0 text-[13px] text-red-600 dark:text-red-400"
      >
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="pg-cancel-btn"
          data-testid="import-cancel"
          @click="dismiss"
        >
          {{ t.importModal.cancel }}
        </button>
        <button
          type="button"
          class="pg-cta h-9 px-4 text-[13px] rounded-md"
          data-testid="import-confirm"
          :disabled="converting || !editor"
          @click="runConvert"
        >
          {{ t.importModal.import }}
        </button>
      </div>
    </div>
  </div>
</template>
