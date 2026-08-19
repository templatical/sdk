<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useI18n } from "../composables/useI18n";
import { inputClass } from "../constants/styleConstants";

const props = defineProps<{
  /** The loaded template's name. Undefined renders the "Untitled" placeholder. */
  name?: string;
  /**
   * Whether the name may be changed. False when the provider withheld `save`:
   * there would be nowhere for the new name to go, so it renders as plain text.
   */
  editable: boolean;
}>();

const emit = defineEmits<{
  (e: "commit", name: string): void;
}>();

const { t } = useI18n();

const isEditing = ref(false);
const draft = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

async function startEditing(): Promise<void> {
  if (!props.editable) return;
  draft.value = props.name ?? "";
  isEditing.value = true;
  await nextTick();
  inputEl.value?.focus();
  inputEl.value?.select();
}

function commit(): void {
  // Escape already left edit mode, and removing the input fires `blur` — which
  // would otherwise commit the very draft the user just cancelled.
  if (!isEditing.value) return;
  isEditing.value = false;
  const next = draft.value.trim();
  // An empty name is rejected by reverting: the header would have nothing to
  // render, and a cleared field is far more likely a slip than an intent.
  if (!next || next === props.name) return;
  emit("commit", next);
}

function cancel(): void {
  isEditing.value = false;
}
</script>

<template>
  <input
    v-if="isEditing"
    ref="inputEl"
    v-model="draft"
    type="text"
    data-testid="template-name-input"
    :aria-label="t.header.templateName"
    :class="[
      inputClass,
      'tpl:h-8 tpl:max-w-[260px] tpl:text-sm tpl:font-medium',
    ]"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
    @blur="commit"
  />
  <button
    v-else-if="editable"
    type="button"
    data-testid="template-name"
    :title="t.header.rename"
    :aria-label="t.header.rename"
    class="tpl:max-w-[260px] tpl:cursor-pointer tpl:truncate tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-transparent tpl:px-2 tpl:py-1 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:hover:border-[var(--tpl-border)] tpl:hover:bg-[var(--tpl-bg-hover)]"
    :class="{ 'tpl:text-[var(--tpl-text-dim)]': !name }"
    @click="startEditing"
  >
    {{ name || t.header.untitled }}
  </button>
  <span
    v-else
    data-testid="template-name"
    class="tpl:max-w-[260px] tpl:truncate tpl:px-2 tpl:py-1 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text)]"
    :class="{ 'tpl:text-[var(--tpl-text-dim)]': !name }"
  >
    {{ name || t.header.untitled }}
  </span>
</template>
