<script setup lang="ts">
import TplModal from "./TplModal.vue";
import { useI18n } from "../../composables";
import { LoaderCircle } from "@lucide/vue";
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  allowedEmails: string[];
  isSending: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: "send", recipient: string): void;
  (e: "close"): void;
}>();

const { t } = useI18n();

const recipient = ref("");

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      recipient.value = props.allowedEmails[0] ?? "";
    }
  },
);

function handleSend(): void {
  if (!recipient.value || props.isSending) {
    return;
  }

  emit("send", recipient.value);
}

function handleClose(): void {
  if (!props.isSending) {
    emit("close");
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
  if (event.key === "Escape") {
    handleClose();
  }
}
</script>

<template>
  <TplModal :visible="visible" @close="handleClose" @keydown="handleKeydown">
    <div
      role="dialog"
      aria-modal="true"
      :aria-busy="isSending"
      aria-labelledby="tpl-test-email-title"
      class="tpl-scale-in tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <h3
        id="tpl-test-email-title"
        class="tpl:mb-4 tpl:text-sm tpl:font-semibold"
        style="color: var(--tpl-text)"
      >
        {{ t.testEmail.title }}
      </h3>

      <!-- Recipient -->
      <div class="tpl:mb-3">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium"
          style="color: var(--tpl-text-muted)"
        >
          {{ t.testEmail.recipientLabel }}
        </label>
        <input
          v-if="allowedEmails.length === 1"
          type="text"
          :value="recipient"
          disabled
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:opacity-70 tpl:shadow-xs tpl:outline-none"
          style="
            border-color: var(--tpl-border);
            background-color: var(--tpl-bg);
            color: var(--tpl-text);
          "
        />
        <select
          v-else
          v-model="recipient"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-xs tpl:outline-none"
          style="
            border-color: var(--tpl-border);
            background-color: var(--tpl-bg);
            color: var(--tpl-text);
          "
          :disabled="isSending"
        >
          <option v-for="email in allowedEmails" :key="email" :value="email">
            {{ email }}
          </option>
        </select>
      </div>

      <!-- Error message -->
      <p
        v-if="error"
        role="alert"
        class="tpl:mb-3 tpl:text-xs"
        style="color: var(--tpl-danger)"
      >
        {{ error }}
      </p>

      <!-- Actions -->
      <div class="tpl:flex tpl:justify-end tpl:gap-2">
        <button
          type="button"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150"
          style="
            border-color: var(--tpl-border);
            color: var(--tpl-text);
            background-color: var(--tpl-bg);
          "
          :disabled="isSending"
          :class="{
            'tpl:cursor-not-allowed tpl:opacity-50': isSending,
          }"
          @click="handleClose"
        >
          {{ t.testEmail.cancel }}
        </button>
        <button
          type="button"
          class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
          style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
          :disabled="!recipient || isSending"
          @click="handleSend"
        >
          <span v-if="isSending" class="tpl:flex tpl:items-center tpl:gap-1.5">
            <LoaderCircle
              class="tpl:animate-spin"
              :size="12"
              :stroke-width="2"
            />
            {{ t.testEmail.sending }}
          </span>
          <span v-else>
            {{ t.testEmail.send }}
          </span>
        </button>
      </div>
    </div>
  </TplModal>
</template>
