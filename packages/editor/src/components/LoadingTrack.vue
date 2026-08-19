<template>
  <div class="tpl-loading-track"></div>
</template>

<style scoped>
.tpl-loading-track {
  height: 3px;
  width: 100%;
  border-radius: 9999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--tpl-primary) 10%, transparent) 15%,
    color-mix(in srgb, var(--tpl-primary) 30%, transparent) 30%,
    var(--tpl-primary) 50%,
    color-mix(in srgb, var(--tpl-primary) 30%, transparent) 70%,
    color-mix(in srgb, var(--tpl-primary) 10%, transparent) 85%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: tpl-loading-flow 3s ease-in-out infinite;
}

@keyframes tpl-loading-flow {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
/* The bar communicates "working" by its presence and its amber fill; the sweep
   is decoration, so reduced motion holds it still rather than removing it. */
@media (prefers-reduced-motion: reduce) {
  .tpl-loading-track-fill {
    animation: none;
    background-position: 50% 0;
  }
}
</style>
