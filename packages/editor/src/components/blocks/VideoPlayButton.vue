<template>
  <div
    class="tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:bg-black/30"
    :class="hoverEffect && 'tpl:transition-opacity tpl:group-hover:bg-black/40'"
  >
    <div
      class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-white/90 tpl:shadow-lg"
    >
      <svg
        class="tpl:ml-1"
        style="color: var(--tpl-danger)"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <polygon points="5,3 19,12 5,21" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    hoverEffect?: boolean;
  }>(),
  { hoverEffect: false },
);
</script>
