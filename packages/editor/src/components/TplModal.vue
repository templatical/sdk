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
      enter-active-class="tpl:transition"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:duration-100"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <!-- The backdrop is the reference box every slotted panel caps against,
           which is why it owns the gutter (`p-4`) rather than each panel
           carrying its own margin. `inset-0` gives it a definite height; the
           wrapper below spans that height so a panel's percentage cap
           (`max-h-[90%]` / `max-h-[80%]`) has an unbroken chain to resolve
           through. Those numbers are the `vh` values they replaced, so an
           untrapped editor renders exactly as before.

           Panels must never cap in `vh`. `fixed` covers the viewport only while
           nothing traps it, and an ancestor with `transform`, `filter`,
           `backdrop-filter`, `will-change: transform`, `contain: paint`,
           `container-type` or a transform animation becomes the containing
           block for fixed descendants. The editor is embedded in someone
           else's page, so any of those can sit above it: `inset-0` then
           resolves to that ancestor's box while a `vh` cap still resolves to
           the viewport, and the panel overflows a container that usually also
           has `overflow: hidden`. That is issue #575 — in a 420px host inside a
           720px viewport, a 648px panel clipped ~113px off both the top and the
           bottom, with no scrollbar to reach the buttons. Capping against the
           backdrop is self-correcting whether or not the trap is present.
           Locked by `tests/overlay-height-scope.test.ts`.

           The padding belongs here and not on the wrapper: preflight is
           omitted, so non-form elements keep `content-box` and padding on an
           `h-full` element would add to 100% and overflow by exactly the
           padding (the trap behind issue #115). Insets size the backdrop's
           border box, so padding here safely shrinks the content box instead. -->
      <div
        v-if="visible"
        :data-tpl-theme="tplUiTheme"
        class="tpl tpl:fixed tpl:inset-0 tpl:z-modal tpl:flex tpl:items-center tpl:justify-center tpl:p-4"
        style="
          background-color: var(--tpl-overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
        :style="themeStyles"
        @click.self="emit('close')"
        @keydown="handleKeydown"
      >
        <!-- `h-full` only, deliberately no `w-full`: height is what has to
             become definite, and widening this element would change what
             `w-full` on a panel resolves against. Panels are shrink-to-fit
             horizontally — the test-email dialog stays compact until its
             preview opens, and the saved-blocks browser pins an explicit width
             precisely because this wrapper is shrink-to-fit. Constraining one
             axis leaves all of that intact.

             It repeats `@click.self` because it now covers the backdrop's full
             height: clicks in the gap above or below the panel land here, so
             without it click-outside-to-close would only work on the padding
             ring and the columns either side. -->
        <div
          ref="dialogRef"
          class="tpl:flex tpl:h-full tpl:items-center tpl:justify-center"
          @click.self="emit('close')"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
