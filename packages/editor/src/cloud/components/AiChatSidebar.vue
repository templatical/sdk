<script setup lang="ts">
import LoadingTrack from "../../components/LoadingTrack.vue";
import { useAiChat } from "@templatical/core/cloud";
import {
  TRANSLATIONS_KEY,
  EDITOR_KEY,
  AUTH_MANAGER_KEY,
  MERGE_TAGS_KEY,
} from "../../keys";
import type { TemplateContent } from "@templatical/types";
import {
  CircleAlert,
  LoaderCircle,
  Redo2,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "@lucide/vue";
import { inject, nextTick, ref, watch } from "vue";
import { useIntervalFn, useTimeoutFn } from "@vueuse/core";

const props = defineProps<{
  visible: boolean;
  onApply?: (content: TemplateContent) => void;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const translations = inject(TRANSLATIONS_KEY)!;
const editor = inject(EDITOR_KEY)!;
const authManager = inject(AUTH_MANAGER_KEY)!;
const mergeTags = inject(MERGE_TAGS_KEY, []);

const aiChat = useAiChat({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
  onApply: props.onApply,
  onError: undefined,
});

const promptInput = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const historyLoaded = ref(false);
const visibleSuggestionCount = ref(0);

const { pause: pauseReveal, resume: resumeReveal } = useIntervalFn(
  () => {
    const count = aiChat.suggestions.value?.length ?? 0;
    if (visibleSuggestionCount.value < count) {
      visibleSuggestionCount.value++;
    } else {
      pauseReveal();
    }
  },
  150,
  { immediate: false },
);

const { start: startRevealTimeout } = useTimeoutFn(() => resumeReveal(), 100, {
  immediate: false,
});

watch(
  () => aiChat.suggestions.value?.length ?? 0,
  (count) => {
    pauseReveal();
    if (count === 0) {
      visibleSuggestionCount.value = 0;
      return;
    }

    visibleSuggestionCount.value = 0;
    startRevealTimeout();
  },
);

function scrollToBottom(): void {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(
  () => aiChat.messages.value?.length ?? 0,
  () => scrollToBottom(),
);

watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible && !historyLoaded.value) {
      historyLoaded.value = true;
      await aiChat.loadConversation();

      if (
        (aiChat.messages.value?.length ?? 0) === 0 &&
        editor.content.value.blocks.length === 0
      ) {
        aiChat.loadSuggestions(editor.content.value, mergeTags);
      }
    }
  },
);

async function handleSend(): Promise<void> {
  const prompt = promptInput.value.trim();
  if (!prompt || aiChat.isGenerating.value) {
    return;
  }

  promptInput.value = "";
  aiChat.error.value = null;
  aiChat.failedPrompt.value = null;
  scrollToBottom();

  await aiChat.sendPrompt(prompt, editor.content.value, mergeTags);

  if (aiChat.failedPrompt.value) {
    promptInput.value = aiChat.failedPrompt.value;
  }

  scrollToBottom();
}

function stripJsonBlock(text: string): string {
  return text
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/```json[\s\S]*/g, "")
    .trim();
}

function handleSuggestionClick(suggestion: string): void {
  pauseReveal();
  promptInput.value = suggestion;
  handleSend();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <Transition
    enter-active-class="tpl-ai-slide-enter-active"
    enter-from-class="tpl:translate-x-full"
    enter-to-class="tpl:translate-x-0"
    leave-active-class="tpl-ai-slide-leave-active"
    leave-from-class="tpl:translate-x-0"
    leave-to-class="tpl:translate-x-full"
  >
    <div
      v-if="visible"
      class="tpl-ai-sidebar tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:z-panel tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-primary)]"
        >
          <Sparkles :size="13" :stroke-width="2" />
          <span>
            {{ translations.aiChat.title }}
          </span>
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-1">
          <button
            v-if="(aiChat.messages.value?.length ?? 0) > 0"
            class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150"
            style="color: var(--tpl-text-muted)"
            :title="translations.aiChat.clear"
            @click="aiChat.clearChat()"
          >
            <Trash2 :size="14" :stroke-width="2" />
          </button>
          <button
            class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150"
            style="color: var(--tpl-text-muted)"
            @click="emit('close')"
          >
            <X :size="14" :stroke-width="2" />
          </button>
        </div>
      </div>

      <!-- Messages wrapper -->
      <div class="tpl:relative tpl:flex tpl:min-h-0 tpl:flex-1 tpl:flex-col">
        <!-- Messages -->
        <div
          ref="messagesContainer"
          class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4"
        >
          <!-- Loading history state -->
          <div
            v-if="aiChat.isLoadingHistory.value"
            class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
          >
            <LoaderCircle
              class="tpl-spinner"
              :size="24"
              :stroke-width="2"
              style="color: var(--tpl-text-muted)"
            />
            <p class="tpl:text-sm" style="color: var(--tpl-text-muted)">
              {{ translations.aiChat.loadingHistory }}
            </p>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="(aiChat.messages.value?.length ?? 0) === 0"
            class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
          >
            <Sparkles
              :size="32"
              :stroke-width="1.5"
              style="color: var(--tpl-text-dim)"
            />
            <p
              class="tpl:max-w-[240px] tpl:text-sm"
              style="color: var(--tpl-text-muted)"
            >
              {{ translations.aiChat.placeholder }}
            </p>
          </div>

          <!-- Message list -->
          <div v-else class="tpl:flex tpl:flex-col tpl:gap-4">
            <div
              v-for="(message, index) in aiChat.messages.value"
              :key="message.id"
              class="tpl:flex tpl:flex-col tpl:gap-2"
            >
              <!-- User message -->
              <div
                v-if="message.role === 'user'"
                class="tpl:self-end tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3.5 tpl:py-2.5 tpl:text-sm"
                style="
                  background-color: var(--tpl-primary-light);
                  color: var(--tpl-text);
                  max-width: 85%;
                  box-shadow: var(--tpl-shadow);
                "
              >
                {{ message.content }}
              </div>

              <!-- Assistant message -->
              <div v-else class="tpl:flex tpl:flex-col tpl:gap-2">
                <LoadingTrack
                  v-if="
                    !stripJsonBlock(message.content) &&
                    aiChat.isGenerating.value &&
                    index === (aiChat.messages.value?.length ?? 0) - 1
                  "
                />
                <div
                  v-else
                  class="tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3.5 tpl:py-2.5 tpl:text-sm tpl:whitespace-pre-wrap"
                  style="
                    max-width: 85%;
                    background-color: var(--tpl-bg);
                    color: var(--tpl-text);
                    box-shadow: var(--tpl-shadow);
                  "
                >
                  {{
                    stripJsonBlock(message.content) ||
                    translations.aiChat.applied
                  }}
                </div>
                <button
                  v-if="
                    message.id === aiChat.lastApplyMessageId.value &&
                    !aiChat.isGenerating.value
                  "
                  class="tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:self-start tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
                  style="
                    border-color: var(--tpl-border);
                    color: var(--tpl-text-muted);
                    background-color: transparent;
                  "
                  @click="aiChat.toggleLastRevert()"
                >
                  <template v-if="aiChat.isLastChangeReverted.value">
                    <Redo2 :size="12" :stroke-width="2" />
                    {{ translations.aiChat.reapply }}
                  </template>
                  <template v-else>
                    <Undo2 :size="12" :stroke-width="2" />
                    {{ translations.aiChat.revert }}
                  </template>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Error message -->
        <div
          v-if="aiChat.error.value"
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
          />
          <span>{{
            aiChat.error.value === "ai_apply_failed"
              ? translations.aiChat.applyFailed
              : translations.aiChat.error
          }}</span>
        </div>

        <!-- Suggestions (overlay) -->
        <div
          v-if="(aiChat.suggestions.value?.length ?? 0) > 0"
          class="tpl:absolute tpl:right-0 tpl:bottom-0 tpl:left-0 tpl:z-10 tpl:px-3 tpl:pb-3"
          style="
            background-color: color-mix(
              in srgb,
              var(--tpl-bg) 50%,
              transparent
            );
            backdrop-filter: blur(2px);
          "
        >
          <div class="tpl:flex tpl:flex-col tpl:gap-1.5">
            <button
              v-for="(suggestion, index) in aiChat.suggestions.value ?? []"
              :key="index"
              class="tpl-suggestion-btn tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3 tpl:py-2 tpl:text-left tpl:text-xs tpl:leading-snug tpl:transition-all tpl:duration-300 tpl:ease-out"
              :class="
                (aiChat.suggestions.value?.length ?? 0) - 1 - index <
                visibleSuggestionCount
                  ? 'tpl:translate-y-0 tpl:opacity-100'
                  : 'tpl:pointer-events-none tpl:-translate-y-2 tpl:opacity-0'
              "
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-primary);
                background-color: var(--tpl-bg);
                box-shadow: var(--tpl-shadow);
              "
              @click="handleSuggestionClick(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="tpl:border-t tpl:p-3" style="border-color: var(--tpl-border)">
        <div
          class="tpl-ai-input-wrapper tpl:flex tpl:items-end tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:px-3 tpl:py-2"
          style="
            border-color: var(--tpl-border);
            background-color: var(--tpl-bg);
          "
        >
          <textarea
            v-model="promptInput"
            class="tpl:max-h-32 tpl:min-h-[64px] tpl:flex-1 tpl:resize-none tpl:border-none tpl:bg-transparent tpl:font-sans tpl:text-sm tpl:outline-none"
            style="color: var(--tpl-text)"
            :placeholder="translations.aiChat.inputPlaceholder"
            :disabled="aiChat.isGenerating.value"
            rows="3"
            @keydown="handleKeydown"
          />
          <button
            class="tpl-ai-send-btn tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:duration-150 tpl:disabled:opacity-40"
            style="color: var(--tpl-primary)"
            :disabled="!promptInput.trim() || aiChat.isGenerating.value"
            @click="handleSend"
          >
            <Send :size="16" :stroke-width="2" />
          </button>
        </div>

        <!-- AI disclaimer -->
        <p
          class="tpl:m-0 tpl:px-1 tpl:pt-2 tpl:text-center tpl:text-[11px]"
          style="color: var(--tpl-text-dim)"
        >
          {{ translations.aiMenu.disclaimer }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tpl-ai-slide-enter-active {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-ai-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-ai-input-wrapper:focus-within {
  border-color: var(--tpl-primary);
  box-shadow: var(--tpl-ring);
}

.tpl-ai-send-btn:not(:disabled):hover {
  transform: scale(1.05);
}

.tpl-suggestion-btn:hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
