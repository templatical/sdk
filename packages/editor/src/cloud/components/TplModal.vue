<script setup lang="ts">
import { useFocusTrap } from "../../composables";
import { UI_THEME_KEY } from "../../keys";
import { computed, inject, ref } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "keydown", event: KeyboardEvent): void;
}>();

const dialogRef = ref<HTMLElement | null>(null);
const isVisible = computed(() => props.visible);
useFocusTrap(dialogRef, isVisible);

const tplUiTheme = inject(UI_THEME_KEY);

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
  emit("keydown", event);
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="tpl:transition tpl:duration-150"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:duration-100"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <div
        v-if="visible"
        :data-tpl-theme="tplUiTheme"
        class="tpl tpl:fixed tpl:inset-0 tpl:z-modal tpl:flex tpl:items-center tpl:justify-center"
        style="
          background-color: var(--tpl-overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
        @click.self="emit('close')"
        @keydown="handleKeydown"
      >
        <div ref="dialogRef">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
