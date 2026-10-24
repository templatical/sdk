<script setup lang="ts">
import {
  CircleAlert,
  FileText,
  Image,
  Paperclip,
  X,
  LoaderCircle,
  MessageSquarePlus,
  Redo2,
  Send,
  Sparkles,
  Square,
  Undo2,
} from "@lucide/vue";
import { computed, inject, nextTick, ref, watch } from "vue";
import { useIntervalFn, useTimeoutFn } from "@vueuse/core";
import LoadingTrack from "../LoadingTrack.vue";
import AiPanelShell from "./AiPanelShell.vue";
import type {
  AiChatItem,
  UseAiFeatureReturn,
} from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";
import { UI_LOCALE_KEY } from "../../keys";
import { validateChatAttachments } from "../../utils/aiAttachments";
import { aiErrorMessage } from "../../utils/aiErrors";

const props = defineProps<{ feature: UseAiFeatureReturn }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, format } = useI18n();
const uiLocale = inject(UI_LOCALE_KEY, undefined);

const promptInput = ref("");
const composer = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const attachments = ref<File[]>([]);
const attachmentErrors = ref<string[]>([]);
const dragDepth = ref(0);
watch(
  () => props.feature.templateSession.value,
  () => {
    promptInput.value = "";
    attachments.value = [];
    attachmentErrors.value = [];
    dragDepth.value = 0;
  },
  { flush: "sync" },
);
const canAttach = computed(() => props.feature.has("chatAttachments"));
function attach(files: File[]): void {
  const result = validateChatAttachments(attachments.value, files);
  attachments.value = result.accepted;
  const keys = {
    tooMany: "attachTooMany",
    tooLarge: "attachTooLarge",
    totalTooLarge: "attachTotalTooLarge",
    wrongType: "attachWrongType",
  } as const;
  attachmentErrors.value = result.errors.map((error) =>
    format(t.ai.chat[keys[error.reason]], { name: error.name }),
  );
}
function picked(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!isBusy.value && canAttach.value) attach(Array.from(input.files ?? []));
  input.value = "";
}
function removeAttachment(index: number): void {
  if (isBusy.value) return;
  attachments.value.splice(index, 1);
  attachmentErrors.value = [];
}
function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}
function dragEnter(event: DragEvent): void {
  if (!canAttach.value || isBusy.value || !isFileDrag(event)) return;
  event.preventDefault();
  dragDepth.value++;
}
function dragLeave(event: DragEvent): void {
  if (!isFileDrag(event)) return;
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}
function dragOver(event: DragEvent): void {
  if (canAttach.value && isFileDrag(event)) event.preventDefault();
}
function drop(event: DragEvent): void {
  dragDepth.value = 0;
  if (!canAttach.value || !isFileDrag(event)) return;
  event.preventDefault();
  if (!isBusy.value) attach(Array.from(event.dataTransfer?.files ?? []));
}
watch(
  () => props.feature.importQueue.value,
  (files) => {
    if (!canAttach.value || !files.length) return;
    attach(files);
    if (!promptInput.value.trim()) promptInput.value = t.ai.import.prompt;
    props.feature.importQueue.value = [];
    void nextTick(() => composer.value?.focus());
  },
  { immediate: true },
);
const messagesContainer = ref<HTMLElement | null>(null);
const visibleStarterCount = ref(0);

const starters = computed(() =>
  props.feature.isTemplateEmpty.value
    ? [
        t.ai.starters.emptyWelcome,
        t.ai.starters.emptyLaunch,
        t.ai.starters.emptyNewsletter,
      ]
    : [
        t.ai.starters.filledShorten,
        t.ai.starters.filledFriendlier,
        t.ai.starters.filledDates,
        t.ai.starters.filledCta,
      ],
);
const messages = computed(() => props.feature.messages.value);
const isBusy = computed(() => props.feature.isRunning.value);
const failureText = computed(() => {
  const failure = props.feature.failure.value;
  return failure
    ? aiErrorMessage(
        failure.error,
        t.ai.errors,
        format,
        uiLocale,
        failure.context,
      )
    : "";
});

const { pause: pauseReveal, resume: resumeReveal } = useIntervalFn(
  () => {
    if (visibleStarterCount.value < starters.value.length) {
      visibleStarterCount.value++;
    } else {
      pauseReveal();
    }
  },
  150,
  { immediate: false },
);
const { start: startReveal } = useTimeoutFn(() => resumeReveal(), 100, {
  immediate: false,
});

watch(
  () => starters.value.length,
  (count) => {
    pauseReveal();
    visibleStarterCount.value = 0;
    if (count > 0) startReveal();
  },
  { immediate: true },
);

function scrollToBottom(): void {
  void nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(() => messages.value.length, scrollToBottom);

// A failed turn gives its prompt back (D15).
watch(
  () =>
    [
      props.feature.failedPrompt.value,
      props.feature.failedAttachments.value,
    ] as const,
  ([prompt, files]) => {
    if (prompt) {
      promptInput.value = prompt;
      attachments.value = [...files];
    }
  },
  { immediate: true },
);

async function send(): Promise<void> {
  const prompt = promptInput.value.trim();
  if (!prompt || isBusy.value) return;
  const files = [...attachments.value];
  promptInput.value = "";
  attachments.value = [];
  attachmentErrors.value = [];
  scrollToBottom();
  await props.feature.send(prompt, files);
  scrollToBottom();
}

function appliedLabel(item: AiChatItem): string {
  if (item.undone) return t.ai.chat.undone;
  return item.operationCount === 1
    ? t.ai.chat.appliedChange
    : format(t.ai.chat.appliedChanges, { count: item.operationCount });
}

function itemFailure(item: AiChatItem): string {
  return item.failure
    ? aiErrorMessage(
        item.failure.error,
        t.ai.errors,
        format,
        uiLocale,
        item.failure.context,
      )
    : "";
}

function toggleUndo(item: AiChatItem): void {
  if (item.undone) void props.feature.redoMessage(item.id);
  else void props.feature.undoMessage(item.id);
}

function chooseStarter(starter: string): void {
  pauseReveal();
  promptInput.value = starter;
  void send();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
}
</script>

<template>
  <div
    class="tpl:contents"
    data-testid="ai-chat-dropzone"
    @dragenter="dragEnter"
    @dragleave="dragLeave"
    @dragover="dragOver"
    @drop="drop"
  >
    <AiPanelShell
      :title="t.ai.chat.title"
      :subtitle="t.ai.chat.notice"
      testid="ai-panel-chat"
      :close-label="t.ai.chat.close"
      @close="emit('close')"
    >
      <template #actions>
        <button
          v-if="feature.canClear && messages.length > 0"
          type="button"
          data-testid="ai-chat-new"
          class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:text-[var(--tpl-text-muted)] tpl:disabled:opacity-40"
          :aria-label="t.ai.chat.newChat"
          :title="t.ai.chat.newChat"
          :disabled="isBusy"
          @click="feature.newChat()"
        >
          <MessageSquarePlus :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </template>

      <div
        v-if="canAttach && dragDepth > 0 && !isBusy"
        data-testid="ai-chat-drop-hint"
        class="tpl:absolute tpl:inset-0 tpl:z-20 tpl:flex tpl:items-center tpl:justify-center tpl:border-2 tpl:border-dashed tpl:border-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-4 tpl:text-center tpl:text-sm tpl:text-[var(--tpl-primary)] tpl:pointer-events-none"
      >
        {{ t.ai.chat.dropHint }}
      </div>
      <div
        ref="messagesContainer"
        class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4"
      >
        <div
          v-if="feature.isLoadingHistory.value"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <LoaderCircle
            class="tpl-spinner tpl:text-[var(--tpl-text-muted)]"
            :size="24"
            :stroke-width="2"
            aria-hidden="true"
          />
          <p class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
            {{ t.ai.chat.loadingHistory }}
          </p>
        </div>

        <div
          v-else-if="messages.length === 0"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <Sparkles
            :size="32"
            :stroke-width="1.5"
            class="tpl:text-[var(--tpl-text-dim)]"
            aria-hidden="true"
          />
          <p
            class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.ai.chat.placeholder }}
          </p>
        </div>

        <!-- Text is interpolated, never `v-html`. -->
        <div v-else class="tpl:flex tpl:flex-col tpl:gap-4">
          <div
            v-for="item in messages"
            :key="item.id"
            class="tpl:flex tpl:flex-col tpl:gap-2"
          >
            <div
              v-if="item.role === 'user'"
              data-testid="ai-chat-prompt"
              class="tpl:self-end tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3.5 tpl:py-2.5 tpl:text-sm tpl:whitespace-pre-wrap"
              style="
                background-color: var(--tpl-primary-light);
                color: var(--tpl-text);
                max-width: 85%;
                box-shadow: var(--tpl-shadow);
              "
            >
              {{ item.text }}
              <span
                v-for="(attachment, index) in item.attachments"
                :key="index"
                data-testid="ai-chat-history-attachment"
                class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-1 tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:px-2 tpl:py-1 tpl:text-xs"
              >
                <FileText
                  v-if="attachment.kind === 'pdf'"
                  :size="12"
                  aria-hidden="true"
                /><Image v-else :size="12" aria-hidden="true" />{{
                  attachment.name
                }}
              </span>
            </div>

            <div v-else class="tpl:flex tpl:flex-col tpl:gap-2">
              <LoadingTrack
                v-if="item.text === '' && item.status === 'streaming'"
              />
              <div
                v-else-if="item.text !== ''"
                data-testid="ai-chat-reply"
                class="tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3.5 tpl:py-2.5 tpl:text-sm tpl:whitespace-pre-wrap"
                style="
                  max-width: 85%;
                  background-color: var(--tpl-bg);
                  color: var(--tpl-text);
                  box-shadow: var(--tpl-shadow);
                "
              >
                {{ item.text }}
              </div>
              <div
                v-if="item.operationCount > 0"
                data-testid="ai-chat-applied"
                class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
              >
                <span>{{ appliedLabel(item) }}</span>
                <button
                  v-if="item.undone ? item.canRedo : item.canUndo"
                  type="button"
                  data-testid="ai-chat-undo"
                  :class="secondaryBtnCompactClass"
                  :disabled="isBusy"
                  @click="toggleUndo(item)"
                >
                  <Redo2
                    v-if="item.undone"
                    :size="12"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                  <Undo2
                    v-else
                    :size="12"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                  {{ item.undone ? t.ai.chat.redo : t.ai.chat.undo }}
                </button>
              </div>
              <p
                v-if="item.failure"
                role="alert"
                data-testid="ai-chat-item-error"
                class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
              >
                {{ itemFailure(item) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Starter prompts, over the empty state (D21). -->
      <div
        v-if="messages.length === 0 && starters.length > 0"
        class="tpl:absolute tpl:right-0 tpl:bottom-0 tpl:left-0 tpl:z-10 tpl:px-3 tpl:pb-3"
        style="
          background-color: color-mix(in srgb, var(--tpl-bg) 50%, transparent);
          backdrop-filter: blur(2px);
        "
      >
        <div class="tpl:flex tpl:flex-col tpl:gap-1.5">
          <button
            v-for="(starter, index) in starters"
            :key="index"
            type="button"
            data-testid="ai-chat-starter"
            class="tpl-starter-btn tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3 tpl:py-2 tpl:text-left tpl:text-xs tpl:leading-snug tpl:transition-all tpl:duration-300 tpl:ease-out"
            :class="
              starters.length - 1 - index < visibleStarterCount
                ? 'tpl:translate-y-0 tpl:opacity-100'
                : 'tpl:pointer-events-none tpl:-translate-y-2 tpl:opacity-0'
            "
            style="
              border-color: var(--tpl-border);
              color: var(--tpl-primary);
              background-color: var(--tpl-bg);
              box-shadow: var(--tpl-shadow);
            "
            @click="chooseStarter(starter)"
          >
            {{ starter }}
          </button>
        </div>
      </div>

      <template #footer>
        <div class="tpl:border-t tpl:p-3 tpl:border-[var(--tpl-border)]">
          <template v-if="canAttach">
            <input
              ref="fileInput"
              data-testid="ai-chat-files"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              hidden
              :disabled="isBusy"
              @change="picked"
            />
            <div
              v-if="attachments.length"
              class="tpl:mb-2 tpl:flex tpl:flex-wrap tpl:gap-1"
            >
              <span
                v-for="(file, index) in attachments"
                :key="index"
                data-testid="ai-chat-attachment"
                class="tpl:flex tpl:max-w-full tpl:items-center tpl:gap-1 tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text)]"
              >
                <FileText
                  v-if="file.type === 'application/pdf'"
                  :size="12"
                  aria-hidden="true"
                /><Image v-else :size="12" aria-hidden="true" />
                <span class="tpl:truncate">{{ file.name }}</span>
                <button
                  type="button"
                  :aria-label="
                    format(t.ai.chat.removeAttachment, { name: file.name })
                  "
                  :disabled="isBusy"
                  class="tpl:shrink-0 tpl:rounded tpl:p-0.5 tpl:disabled:opacity-40"
                  @click="removeAttachment(index)"
                >
                  <X :size="12" aria-hidden="true" />
                </button>
              </span>
            </div>
            <p
              v-if="attachments.length"
              class="tpl:mb-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
            >
              {{ t.ai.import.placeholderNote }}
            </p>
            <div
              aria-live="polite"
              class="tpl:text-xs tpl:text-[var(--tpl-danger)]"
            >
              <p
                v-for="(error, index) in attachmentErrors"
                :key="index"
                class="tpl:mb-2"
              >
                {{ error }}
              </p>
            </div>
          </template>
          <div
            v-if="feature.keptYourVersion.value"
            role="status"
            class="tpl:mb-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
          >
            <p>{{ t.ai.chat.keptYourVersion }}</p>
            <button
              type="button"
              :disabled="isBusy"
              :class="secondaryBtnCompactClass"
              @click="feature.reloadTemplate()"
            >
              {{ t.ai.chat.reload }}
            </button>
          </div>
          <div
            v-if="failureText"
            role="alert"
            data-testid="ai-chat-error"
            class="tpl:mx-3 tpl:mb-2 tpl:flex tpl:items-start tpl:gap-2 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:text-xs"
            style="
              background-color: var(--tpl-danger-light);
              color: var(--tpl-danger);
            "
          >
            <CircleAlert
              :size="14"
              :stroke-width="2"
              class="tpl:mt-0.5 tpl:shrink-0"
              aria-hidden="true"
            />
            <span>{{ failureText }}</span>
          </div>
          <div
            class="tpl-ai-input-wrapper tpl-focus-ring-host tpl:flex tpl:flex-col tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
          >
            <textarea
              ref="composer"
              v-model="promptInput"
              data-testid="ai-chat-input"
              class="tpl:max-h-32 tpl:min-h-[44px] tpl:w-full tpl:resize-none tpl:border-none tpl:bg-transparent tpl:font-sans tpl:text-sm tpl:outline-none tpl:text-[var(--tpl-text)]"
              :placeholder="t.ai.chat.inputPlaceholder"
              :aria-label="t.ai.chat.inputPlaceholder"
              :disabled="isBusy"
              maxlength="4000"
              rows="3"
              @keydown="onKeydown"
            />
            <div class="tpl:flex tpl:items-center tpl:justify-between">
              <button
                v-if="canAttach"
                type="button"
                :aria-label="t.ai.chat.attach"
                :title="t.ai.chat.attach"
                :disabled="isBusy"
                class="tpl:-ml-1.5 tpl:shrink-0 tpl:rounded-md tpl:p-1.5 tpl:text-[var(--tpl-text-muted)] tpl:disabled:opacity-40"
                @click="fileInput?.click()"
              >
                <Paperclip :size="16" aria-hidden="true" />
              </button>
              <button
                v-if="isBusy"
                type="button"
                data-testid="ai-chat-stop"
                class="tpl-ai-send-btn tpl:ml-auto tpl:-mr-1.5 tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:text-[var(--tpl-primary)]"
                :aria-label="t.ai.chat.stop"
                :title="t.ai.chat.stop"
                @click="feature.stop()"
              >
                <Square :size="16" :stroke-width="2" aria-hidden="true" />
              </button>
              <button
                v-else
                type="button"
                data-testid="ai-chat-send"
                class="tpl-ai-send-btn tpl:ml-auto tpl:-mr-1.5 tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:disabled:opacity-40 tpl:text-[var(--tpl-primary)]"
                :aria-label="t.ai.chat.send"
                :title="t.ai.chat.send"
                :disabled="!promptInput.trim()"
                @click="send"
              >
                <Send :size="16" :stroke-width="2" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p
            class="tpl:m-0 tpl:px-1 tpl:pt-2 tpl:text-center tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
          >
            {{ t.ai.chat.disclaimer }}
          </p>
        </div>
      </template>
    </AiPanelShell>
  </div>
</template>

<style scoped>
.tpl-ai-input-wrapper:focus-within {
  border-color: var(--tpl-primary);
  box-shadow: var(--tpl-ring);
}

.tpl-ai-send-btn:not(:disabled):hover {
  transform: scale(1.05);
}

.tpl-starter-btn:hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
