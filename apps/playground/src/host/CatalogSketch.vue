<script setup lang="ts">
import type { SceneSketch } from "@/scenes/types";

defineProps<{
  kind: SceneSketch;
}>();
</script>

<template>
  <div
    aria-hidden="true"
    data-testid="catalog-sketch"
    class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200 dark:bg-gray-700/50 dark:border-gray-700"
  >
    <div v-if="kind === 'product'" class="flex flex-col gap-1.5 w-[60%]">
      <div
        class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div class="mx-auto my-1 h-5 w-[40%] rounded bg-primary/30" />
      <div
        class="my-0.5 h-8 w-full rounded bg-gray-200/60 dark:bg-gray-500/40"
      />
      <div
        class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
    </div>
    <div
      v-else-if="kind === 'newsletter'"
      class="flex flex-col gap-1.5 w-[60%]"
    >
      <div
        class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="mx-auto h-1.5 w-[30%] rounded-[3px] bg-gray-200/40 dark:bg-gray-500/30"
      />
      <div
        class="my-0.5 h-8 w-full rounded bg-gray-200/60 dark:bg-gray-500/40"
      />
      <div class="h-1.5 w-[90%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div class="h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div class="h-1.5 w-[80%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
    </div>
    <div v-else-if="kind === 'welcome'" class="flex flex-col gap-1.5 w-[60%]">
      <div
        class="mx-auto h-1.5 w-[35%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="mx-auto h-1.5 w-[60%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div class="flex items-center gap-1.5">
        <div class="size-2.5 shrink-0 rounded-full bg-primary/30" />
        <div
          class="h-1.5 w-[70%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
        />
      </div>
      <div class="flex items-center gap-1.5">
        <div class="size-2.5 shrink-0 rounded-full bg-primary/30" />
        <div
          class="h-1.5 w-[65%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
        />
      </div>
      <div class="flex items-center gap-1.5">
        <div class="size-2.5 shrink-0 rounded-full bg-primary/30" />
        <div
          class="h-1.5 w-[60%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
        />
      </div>
    </div>
    <div v-else-if="kind === 'order'" class="flex flex-col gap-1.5 w-[60%]">
      <div
        class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="mx-auto h-1.5 w-[55%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
      />
      <div class="flex gap-1">
        <div class="h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
        <div class="h-1.5 w-[20%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
        <div class="h-1.5 w-[25%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      </div>
      <div class="flex gap-1">
        <div
          class="h-1.5 w-[40%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
        />
        <div
          class="h-1.5 w-[20%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
        />
        <div
          class="h-1.5 w-[25%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
        />
      </div>
      <div class="mx-auto my-1 h-5 w-[40%] rounded bg-emerald-600/30" />
    </div>
    <div v-else-if="kind === 'event'" class="flex flex-col gap-1.5 w-[60%]">
      <div
        class="mx-auto h-1.5 w-[45%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="mx-auto h-1.5 w-[65%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div
        class="my-0.5 h-8 w-full rounded bg-gray-200/40 dark:bg-gray-500/30"
      />
      <div class="flex justify-center gap-1">
        <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
        <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
        <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      </div>
      <div class="mx-auto my-1 h-5 w-[40%] rounded bg-violet-600/30" />
    </div>
    <div v-else-if="kind === 'sale'" class="flex flex-col gap-1.5 w-[60%]">
      <div class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-amber-400/60" />
      <div
        class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
      />
      <div class="mt-0.5 flex gap-1">
        <div
          class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
        />
        <div
          class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
        />
        <div
          class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
        />
      </div>
      <div class="mx-auto my-1 h-5 w-[40%] rounded bg-amber-400/50" />
    </div>
    <div
      v-else-if="kind === 'reset'"
      class="flex flex-col items-center gap-1.5 w-[60%]"
    >
      <div class="h-1.5 w-[35%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div class="h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div
        class="h-1.5 w-[70%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
      />
      <div class="my-1.5 h-5 w-[45%] rounded bg-primary/30" />
      <div
        class="h-1.5 w-[60%] rounded-[3px] bg-gray-200/30 dark:bg-gray-500/20"
      />
    </div>
    <div
      v-else-if="kind === 'rtl'"
      class="flex flex-col items-end gap-1.5 w-[60%]"
    >
      <div class="h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div class="h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500" />
      <div class="my-1 h-5 w-[45%] rounded bg-blue-500/40" />
      <div class="flex w-full gap-1">
        <div
          class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
        />
        <div
          class="h-7 w-[38%] rounded-[3px] bg-gray-200/60 dark:bg-gray-500/40"
        />
      </div>
    </div>
  </div>
</template>
