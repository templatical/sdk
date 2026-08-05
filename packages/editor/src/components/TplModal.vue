<script setup lang="ts">
import { useFocusTrap } from "../composables";
import { usePopoverRoot } from "../composables/usePopoverRoot";
import { THEME_STYLES_KEY, UI_THEME_KEY } from "../keys";
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

// The backdrop below carries the bare `tpl` class, which re-declares every
// `--tpl-*` token from the base `.tpl` rule. A custom property declared on an
// element beats one inherited from an ancestor, so that re-declaration shadows
// the consumer's `theme` config — which lives as inline styles on the editor
// root — for this whole teleported subtree. Re-applying `themeStyles` here is
// what restores it, and doing it on the backdrop covers every dialog rendered
// through this wrapper rather than each one remembering to. `data-tpl-theme`
// does the same job for the dark token block. See the invariant in
// `tests/theme-token-scope.test.ts` (issue #487).
const themeStyles = inject(THEME_STYLES_KEY, null);
const popoverRoot = usePopoverRoot();

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
  emit("keydown", event);
}
</script>

<template>
  <Teleport v-if="popoverRoot" :to="popoverRoot">
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
        :style="themeStyles"
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
