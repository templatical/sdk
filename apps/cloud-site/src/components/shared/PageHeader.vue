<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  lede?: string;
}>();
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-24 sm:pb-12">
    <div
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-end lg:gap-10"
    >
      <div class="min-w-0">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1
          class="title-tight mt-4 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.1] text-text"
        >
          {{ title }}
        </h1>
      </div>
      <p
        v-if="lede"
        class="max-w-prose text-base leading-relaxed text-text-muted sm:text-lg"
      >
        {{ lede }}
      </p>
    </div>
  </section>
</template>
