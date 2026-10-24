<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { AI_FEATURE_KEY, EDITOR_KEY, UI_LOCALE_KEY } from "../../keys";
import { useI18n } from "../../composables/useI18n";
import { aiErrorMessage } from "../../utils/aiErrors";
import { aiImageSnapshot, sameAiImage } from "../../utils/aiImageContext";
import { isSdkError } from "../../utils/isSdkError";

const props = defineProps<{ blockId: string }>();
const emit = defineEmits<{
  close: [];
  drafting: [controller: AbortController | null];
}>();
const ai = inject(AI_FEATURE_KEY, null);
const editor = inject(EDITOR_KEY, null);
const captured = editor
  ? aiImageSnapshot(editor.content.value, props.blockId)
  : null;
const refused = ref(false);
const stale = computed(
  () =>
    refused.value ||
    (editor !== null &&
      !sameAiImage(
        aiImageSnapshot(editor.content.value, props.blockId),
        captured,
      )),
);
const locale = inject(UI_LOCALE_KEY, "en");
const { t, format } = useI18n();
const alt = ref("");
const drafting = ref(true);
const applying = ref(false);
const failed = ref(false);
const detail = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const controller = new AbortController();
let closed = false;
function editAlt(event: Event): void {
  const input = event.target as HTMLTextAreaElement;
  if (drafting.value) {
    input.value = alt.value;
    return;
  }
  alt.value = input.value;
}
function close(): void {
  closed = true;
  controller.abort();
  emit("drafting", null);
  emit("close");
}
if (ai) watch(ai.templateSession, close, { flush: "sync" });
onMounted(async () => {
  emit("drafting", controller);
  try {
    if (ai) alt.value = await ai.draftAltText(props.blockId, controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) {
      failed.value = true;
      detail.value = aiErrorMessage(error, t.ai.errors, format, locale);
    }
  } finally {
    drafting.value = false;
    emit("drafting", null);
    await nextTick();
    if (!closed) textarea.value?.focus();
  }
});
onUnmounted(() => {
  closed = true;
  controller.abort();
  emit("drafting", null);
});
async function apply(decorative: boolean): Promise<void> {
  if (!ai || applying.value || drafting.value || ai.busy.value || stale.value)
    return;
  applying.value = true;
  try {
    await ai.applyAltTexts([
      {
        blockId: props.blockId,
        alt: decorative ? "" : alt.value,
        decorative,
        ...(captured ? { expect: captured } : {}),
      },
    ]);
    close();
  } catch (error) {
    if (
      isSdkError(error) &&
      (error.code === "precondition_failed" || error.code === "block_missing")
    )
      refused.value = true;
    failed.value = true;
    detail.value = aiErrorMessage(error, t.ai.errors, format, locale);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <div
    class="tpl:mt-3 tpl:flex tpl:flex-col tpl:gap-2"
    @keydown.esc.stop.prevent="close"
  >
    <textarea
      ref="textarea"
      :value="alt"
      :disabled="drafting"
      :readonly="drafting"
      :aria-busy="drafting"
      @input="editAlt"
      :aria-label="t.ai.altText.title"
      rows="3"
      class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
    />
    <p class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-text-muted)]">
      {{ t.ai.altText.note }}
    </p>
    <p
      v-if="stale"
      role="alert"
      class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
    >
      {{ t.ai.altText.stale }}
    </p>
    <p
      v-if="failed && !stale"
      role="alert"
      class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
    >
      {{ t.ai.altText.failed }} {{ detail }}
    </p>
    <div class="tpl:flex tpl:flex-wrap tpl:gap-2">
      <button
        type="button"
        :disabled="drafting || applying || ai?.busy.value || stale"
        class="tpl:rounded-md tpl:bg-[var(--tpl-primary)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-on-primary)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
        @click="apply(false)"
      >
        {{ t.ai.altText.accept }}
      </button>
      <button
        type="button"
        :disabled="drafting || applying || ai?.busy.value || stale"
        class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
        @click="apply(true)"
      >
        {{ t.ai.altText.decorative }}
      </button>
      <button
        type="button"
        class="tpl:rounded-md tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
        @click="close"
      >
        {{ t.ai.altText.cancel }}
      </button>
    </div>
  </div>
</template>
