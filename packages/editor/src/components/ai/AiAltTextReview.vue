<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import type { UseAiFeatureReturn } from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";
import { EDITOR_KEY, UI_LOCALE_KEY } from "../../keys";
import { aiErrorMessage } from "../../utils/aiErrors";
import {
  aiImageSnapshot,
  sameAiImage,
  type AiImageSnapshot,
} from "../../utils/aiImageContext";
import ToggleSwitch from "../ToggleSwitch.vue";

const props = defineProps<{
  blockIds: string[];
  feature: UseAiFeatureReturn;
}>();
const emit = defineEmits<{ close: [] }>();
const editor = inject(EDITOR_KEY, null);
const locale = inject(UI_LOCALE_KEY, "en");
const { t, format } = useI18n();
interface Row {
  blockId: string;
  src: string;
  snapshot: AiImageSnapshot | null;
  text: string;
  decorative: boolean;
  accepted: boolean;
  state: "queued" | "pending" | "done" | "failed" | "stopped" | "stale";
}
// Read the opening snapshot once. A re-lint must not reset an author's review.
const rows = ref<Row[]>(
  props.blockIds.map((blockId) => ({
    blockId,
    src: editor
      ? (aiImageSnapshot(editor.content.value, blockId)?.src ?? "")
      : "",
    snapshot: editor ? aiImageSnapshot(editor.content.value, blockId) : null,
    text: "",
    decorative: false,
    accepted: false,
    state: "queued",
  })),
);
const container = ref<HTMLElement | null>(null);
const applying = ref(false);
const failure = ref("");
const pending = new Map<string, AbortController>();
let stopped = false;
let closed = false;
const drafting = computed(() =>
  rows.value.some((row) => row.state === "queued" || row.state === "pending"),
);
const done = computed(
  () =>
    rows.value.filter((row) => row.state === "done" || row.state === "failed")
      .length,
);
const canAccept = (row: Row): boolean =>
  row.state !== "stale" &&
  row.state !== "queued" &&
  row.state !== "pending" &&
  (row.decorative || row.text.trim().length > 0);
const accepted = computed(() =>
  rows.value.filter((row) => row.accepted && canAccept(row)),
);

function edit(row: Row, event: Event): void {
  const textarea = event.target as HTMLTextAreaElement;
  if (row.state === "queued" || row.state === "pending" || row.decorative) {
    textarea.value = row.text;
    return;
  }
  row.text = textarea.value;
  if (!canAccept(row)) row.accepted = false;
}
function decorate(row: Row, decorative: boolean): void {
  row.decorative = decorative;
  if (row.decorative) row.text = "";
  if (!canAccept(row)) row.accepted = false;
}
function stop(): void {
  stopped = true;
  for (const row of rows.value) {
    if (row.state === "pending" || row.state === "queued") {
      row.state = "stopped";
      row.accepted = false;
    }
  }
  for (const controller of pending.values()) controller.abort();
  pending.clear();
}
function close(): void {
  if (closed) return;
  closed = true;
  stop();
  emit("close");
}
function pump(): void {
  if (closed || stopped) return;
  for (const row of rows.value) {
    if (pending.size >= 3) break;
    if (row.state !== "queued") continue;
    const controller = new AbortController();
    pending.set(row.blockId, controller);
    row.state = "pending";
    void draft(row, controller);
  }
}
async function draft(row: Row, controller: AbortController): Promise<void> {
  try {
    const text = await props.feature.draftAltText(
      row.blockId,
      controller.signal,
    );
    if (closed || controller.signal.aborted) return;
    row.text = row.decorative ? "" : text;
    row.state = "done";
    row.accepted = canAccept(row);
  } catch {
    if (!closed && !controller.signal.aborted) {
      row.state = "failed";
      row.accepted = false;
    }
  } finally {
    pending.delete(row.blockId);
    pump();
  }
}
if (editor) {
  watch(
    editor.content,
    () => {
      for (const row of rows.value) {
        if (
          !sameAiImage(
            aiImageSnapshot(editor.content.value, row.blockId),
            row.snapshot,
          )
        ) {
          row.state = "stale";
          row.accepted = false;
          pending.get(row.blockId)?.abort();
        }
      }
    },
    { deep: true, flush: "sync", immediate: true },
  );
  watch(
    () => rows.value.filter((row) => !editor.findBlockLocation(row.blockId)),
    (deleted) => {
      for (const row of deleted) {
        pending.get(row.blockId)?.abort();
        rows.value = rows.value.filter((candidate) => candidate !== row);
      }
    },
    { flush: "sync", immediate: true },
  );
}
watch(
  [
    props.feature.templateId,
    props.feature.isAvailable,
    () => editor?.loadVersion?.value,
  ],
  close,
  { flush: "sync" },
);
onMounted(() => {
  container.value?.focus();
  pump();
});
onUnmounted(() => {
  closed = true;
  stop();
});
async function apply(): Promise<void> {
  if (
    closed ||
    applying.value ||
    props.feature.busy.value ||
    !accepted.value.length
  )
    return;
  applying.value = true;
  failure.value = "";
  try {
    await props.feature.applyAltTexts(
      accepted.value
        .filter((row) => editor?.findBlockLocation(row.blockId))
        .map((row) => ({
          blockId: row.blockId,
          alt: row.decorative ? "" : row.text.trim(),
          decorative: row.decorative,
          ...(row.snapshot ? { expect: row.snapshot } : {}),
        })),
    );
    close();
  } catch (error) {
    failure.value = aiErrorMessage(error, t.ai.errors, format, locale);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <section
    ref="container"
    tabindex="-1"
    :aria-label="t.ai.altText.review"
    data-testid="ai-alt-text-review"
    class="tpl:flex tpl:flex-col tpl:gap-3 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3 tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
    @keydown.esc.stop.prevent="close"
  >
    <h4
      class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
    >
      {{ t.ai.altText.review }}
    </h4>
    <div
      v-if="drafting"
      role="status"
      class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
    >
      <span>{{
        format(t.ai.altText.progress, { done, total: rows.length })
      }}</span>
      <button
        type="button"
        class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:px-2 tpl:py-1 tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
        @click="stop"
      >
        {{ t.ai.chat.stop }}
      </button>
    </div>
    <p class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-text-muted)]">
      {{ t.ai.altText.note }}
    </p>
    <ul class="tpl:m-0 tpl:flex tpl:list-none tpl:flex-col tpl:gap-3 tpl:p-0">
      <li
        v-for="row in rows"
        :key="row.blockId"
        data-testid="ai-alt-text-row"
        class="tpl:flex tpl:flex-col tpl:gap-2 tpl:border-b tpl:border-[var(--tpl-border)] tpl:pb-3"
      >
        <img
          :src="row.src"
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          style="max-width: 64px; max-height: 64px"
          class="tpl:object-contain"
        />
        <textarea
          :value="row.text"
          :readonly="row.state === 'queued' || row.state === 'pending'"
          :disabled="row.decorative"
          :aria-busy="row.state === 'pending'"
          :aria-label="t.ai.altText.title"
          rows="3"
          class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
          @input="edit(row, $event)"
        />
        <ToggleSwitch
          :model-value="row.decorative"
          :label="t.ai.altText.decorative"
          class="tpl:text-xs tpl:text-[var(--tpl-text)]"
          @update:model-value="decorate(row, $event)"
        />
        <ToggleSwitch
          v-model="row.accepted"
          :label="t.ai.altText.accept"
          :disabled="!canAccept(row)"
          class="tpl:text-xs tpl:text-[var(--tpl-text)]"
        />
        <p
          v-if="row.state === 'stale'"
          role="alert"
          class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
        >
          {{ t.ai.altText.stale }}
        </p>
        <p
          v-if="row.state === 'failed'"
          role="alert"
          class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
        >
          {{ t.ai.altText.failed }}
        </p>
      </li>
    </ul>
    <p
      v-if="failure"
      role="alert"
      class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
    >
      {{ failure }}
    </p>
    <div class="tpl:flex tpl:flex-wrap tpl:gap-2">
      <button
        type="button"
        :disabled="!accepted.length || applying || feature.busy.value"
        class="tpl:rounded-md tpl:bg-[var(--tpl-primary)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-on-primary)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
        @click="apply"
      >
        {{ format(t.ai.altText.applyAccepted, { count: accepted.length }) }}
      </button>
      <button
        type="button"
        class="tpl:rounded-md tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
        @click="close"
      >
        {{ t.ai.altText.cancel }}
      </button>
    </div>
  </section>
</template>
