<script setup lang="ts">
import {
  CircleAlert,
  FileText,
  ImageUp,
  Redo2,
  Undo2,
  Upload,
  X,
} from "@lucide/vue";
import { computed, inject, onBeforeUnmount, ref } from "vue";
import LoadingTrack from "../LoadingTrack.vue";
import AiPanelShell from "./AiPanelShell.vue";
import {
  AI_DESIGN_MAX_BYTES,
  type UseAiFeatureReturn,
} from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";
import {
  primaryBtnClass,
  secondaryBtnCompactClass,
} from "../../constants/styleConstants";
import { EDITOR_KEY, UI_LOCALE_KEY } from "../../keys";
import { aiErrorMessage } from "../../utils/aiErrors";

const props = defineProps<{
  feature: Pick<
    UseAiFeatureReturn,
    | "isRunning"
    | "messages"
    | "failure"
    | "design"
    | "undoMessage"
    | "redoMessage"
  >;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, format } = useI18n();
const editor = inject(EDITOR_KEY, null);
const uiLocale = inject(UI_LOCALE_KEY, undefined);

const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const prompt = ref("");
const fileError = ref<string | null>(null);
const failure = ref<unknown>(null);
const confirming = ref(false);
const isDragging = ref(false);
const builtMessageId = ref<string | null>(null);

const hasBlocks = computed(
  () => (editor?.content.value.blocks.length ?? 0) > 0,
);
const built = computed(() =>
  builtMessageId.value === null
    ? null
    : (props.feature.messages.value.find(
        (item) => item.id === builtMessageId.value,
      ) ?? null),
);
const builtLabel = computed(() => {
  const item = built.value;
  if (item?.status !== "failed") return t.ai.design.built;
  if (item.undone) return t.ai.chat.undone;
  return item.operationCount === 1
    ? t.ai.chat.appliedChange
    : format(t.ai.chat.appliedChanges, { count: item.operationCount });
});
const builtFailureText = computed(() => {
  const itemFailure = built.value?.failure;
  return itemFailure
    ? aiErrorMessage(
        itemFailure.error,
        t.ai.errors,
        format,
        uiLocale,
        itemFailure.context,
      )
    : "";
});
const errorText = computed(
  () =>
    fileError.value ??
    (failure.value
      ? aiErrorMessage(failure.value, t.ai.errors, format, uiLocale)
      : ""),
);

function setFile(next: File): void {
  failure.value = null;
  if (next.size > AI_DESIGN_MAX_BYTES) {
    fileError.value = t.ai.design.fileTooLarge;
    return;
  }
  if (!ACCEPTED.includes(next.type)) {
    fileError.value = t.ai.design.invalidFileType;
    return;
  }
  fileError.value = null;
  clearFile();
  file.value = next;
  if (next.type.startsWith("image/"))
    previewUrl.value = URL.createObjectURL(next);
}

function clearFile(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  file.value = null;
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement;
  const picked = input.files?.[0];
  if (picked) setFile(picked);
  input.value = "";
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
  const dropped = event.dataTransfer?.files?.[0];
  if (dropped) setFile(dropped);
}

async function build(confirmed = false): Promise<void> {
  if (!file.value || props.feature.isRunning.value) return;
  if (hasBlocks.value && !confirmed) {
    confirming.value = true;
    return;
  }
  confirming.value = false;
  failure.value = null;
  const notes = prompt.value.trim();
  const outcome = await props.feature.design({
    file: file.value,
    prompt: notes === "" ? null : notes,
  });
  if (outcome.operationCount > 0 && outcome.messageId !== null) {
    builtMessageId.value = outcome.messageId;
    clearFile();
    prompt.value = "";
  } else if (outcome.failed) {
    // Nothing applied: the turn's error is the feature's (D15).
    failure.value = props.feature.failure.value?.error ?? null;
  }
}

function toggleUndo(): void {
  const item = built.value;
  if (!item || !(item.undone ? item.canRedo : item.canUndo)) return;
  if (item.undone) void props.feature.redoMessage(item.id);
  else void props.feature.undoMessage(item.id);
}

function buildAnother(): void {
  builtMessageId.value = null;
}

onBeforeUnmount(clearFile);
</script>

<template>
  <AiPanelShell
    :title="t.ai.design.title"
    :subtitle="t.ai.chat.notice"
    testid="ai-panel-design"
    :close-label="t.ai.design.close"
    @close="emit('close')"
  >
    <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
      <div
        v-if="feature.isRunning.value"
        class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
      >
        <LoadingTrack />
        <p class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
          {{ t.ai.design.generating }}
        </p>
      </div>

      <!-- Built: a turn with Undo (D24). -->
      <div
        v-else-if="built"
        data-testid="ai-design-built"
        class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-3 tpl:text-center"
      >
        <ImageUp
          :size="32"
          :stroke-width="1.5"
          class="tpl:text-[var(--tpl-primary)]"
          aria-hidden="true"
        />
        <p class="tpl:m-0 tpl:text-sm tpl:text-[var(--tpl-text)]">
          {{ builtLabel }}
        </p>
        <div class="tpl:flex tpl:gap-2">
          <button
            v-if="built.undone ? built.canRedo : built.canUndo"
            type="button"
            data-testid="ai-design-undo"
            :class="secondaryBtnCompactClass"
            @click="toggleUndo"
          >
            <Redo2
              v-if="built.undone"
              :size="12"
              :stroke-width="2"
              aria-hidden="true"
            />
            <Undo2 v-else :size="12" :stroke-width="2" aria-hidden="true" />{{
              built.undone ? t.ai.design.redo : t.ai.design.undo
            }}
          </button>
          <button
            type="button"
            data-testid="ai-design-another"
            :class="secondaryBtnCompactClass"
            @click="buildAnother"
          >
            {{ t.ai.design.buildAnother }}
          </button>
        </div>
        <p
          v-if="built.failure"
          role="alert"
          data-testid="ai-design-built-error"
          class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
        >
          {{ builtFailureText }}
        </p>
      </div>

      <div v-else class="tpl:flex tpl:flex-col tpl:gap-4">
        <div
          v-if="file"
          class="tpl:relative tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="file.name"
            class="tpl:h-auto tpl:max-h-48 tpl:w-full tpl:object-contain"
          />
          <div
            v-else
            class="tpl:flex tpl:h-32 tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2"
          >
            <FileText
              :size="32"
              :stroke-width="1.5"
              class="tpl:text-[var(--tpl-text-dim)]"
              aria-hidden="true"
            />
            <span class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">{{
              file.name
            }}</span>
          </div>
          <button
            type="button"
            data-testid="ai-design-clear"
            class="tpl:absolute tpl:top-2 tpl:right-2 tpl:rounded-full tpl:p-1 tpl:transition-colors tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:shadow-[var(--tpl-shadow)]"
            :aria-label="t.ai.design.remove"
            :title="t.ai.design.remove"
            @click="clearFile"
          >
            <X :size="12" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
        <button
          v-else
          type="button"
          data-testid="ai-design-dropzone"
          class="tpl-design-dropzone tpl:flex tpl:cursor-pointer tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border-2 tpl:border-dashed tpl:px-4 tpl:py-8 tpl:transition-colors"
          :style="{
            borderColor: isDragging
              ? 'var(--tpl-primary)'
              : 'var(--tpl-border-light)',
            backgroundColor: isDragging
              ? 'var(--tpl-primary-light)'
              : 'var(--tpl-bg)',
          }"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop="onDrop"
        >
          <Upload
            :size="24"
            :stroke-width="1.5"
            class="tpl:text-[var(--tpl-text-dim)]"
            aria-hidden="true"
          />
          <span
            class="tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
            >{{ t.ai.design.dropHint }}</span
          >
          <span
            class="tpl:text-center tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
            >{{ t.ai.design.accepted }}</span
          >
        </button>
        <input
          ref="fileInput"
          type="file"
          data-testid="ai-design-file"
          class="tpl:hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          @change="onPick"
        />

        <div class="tpl:flex tpl:flex-col tpl:gap-1.5">
          <label
            for="tpl-ai-design-prompt"
            class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.ai.design.promptLabel }}
          </label>
          <textarea
            id="tpl-ai-design-prompt"
            v-model="prompt"
            data-testid="ai-design-prompt"
            maxlength="2000"
            rows="3"
            class="tpl-design-prompt-input tpl:min-h-[72px] tpl:w-full tpl:resize-none tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3 tpl:py-2 tpl:font-sans tpl:text-sm tpl:outline-none tpl:transition-colors tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
            :placeholder="t.ai.design.promptPlaceholder"
          />
        </div>

        <div
          v-if="confirming"
          class="tpl:flex tpl:flex-col tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:px-3 tpl:py-3 tpl:bg-[var(--tpl-warning-light)] tpl:border tpl:border-[var(--tpl-warning)]"
        >
          <p
            class="tpl:m-0 tpl:text-xs tpl:leading-snug tpl:text-[var(--tpl-text)]"
          >
            {{ t.ai.design.replaceWarning }}
          </p>
          <div class="tpl:flex tpl:gap-2">
            <button
              type="button"
              :class="[secondaryBtnCompactClass, 'tpl:flex-1']"
              @click="confirming = false"
            >
              {{ t.ai.design.replaceCancel }}
            </button>
            <button
              type="button"
              data-testid="ai-design-replace"
              :class="[primaryBtnClass, 'tpl:flex-1']"
              @click="build(true)"
            >
              {{ t.ai.design.replaceConfirm }}
            </button>
          </div>
        </div>

        <div
          v-if="errorText"
          role="alert"
          data-testid="ai-design-error"
          class="tpl:flex tpl:items-start tpl:gap-2 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
        >
          <CircleAlert
            :size="14"
            :stroke-width="2"
            class="tpl:mt-0.5 tpl:shrink-0"
            aria-hidden="true"
          />
          <span>{{ errorText }}</span>
        </div>

        <button
          v-if="!confirming"
          type="button"
          data-testid="ai-design-build"
          :class="[primaryBtnClass, 'tpl:w-full']"
          :disabled="!file || feature.isRunning.value"
          @click="build()"
        >
          <ImageUp :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t.ai.design.generate }}
        </button>

        <p
          class="tpl:m-0 tpl:pt-1 tpl:text-center tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
        >
          {{ t.ai.chat.disclaimer }}
        </p>
      </div>
    </div>
  </AiPanelShell>
</template>

<style scoped>
.tpl-design-prompt-input:focus {
  border-color: var(--tpl-primary);
  box-shadow: var(--tpl-ring);
}

.tpl-design-dropzone:hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
