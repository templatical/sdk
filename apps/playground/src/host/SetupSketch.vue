<script setup lang="ts">
import type { SetupAffordance } from "@/scenes/types";

defineProps<{
  kind: SetupAffordance;
}>();
</script>

<template>
  <div
    aria-hidden="true"
    data-testid="setup-sketch"
    class="w-full h-[88px] flex items-center justify-center bg-gray-50 border-b border-gray-200 px-3 py-2 dark:bg-gray-700/50 dark:border-gray-700"
  >
    <div
      class="flex h-full w-full max-w-[160px] flex-col overflow-hidden rounded-[4px] border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
      :class="
        kind === 'light-dom'
          ? 'outline outline-1 outline-dashed outline-gray-300 dark:outline-gray-500'
          : ''
      "
    >
      <div
        class="flex h-3 shrink-0 items-center gap-0.5 border-b border-gray-100 px-1 dark:border-gray-700"
      >
        <div
          class="h-1.5 w-1.5 rounded-[1px]"
          :class="
            kind === 'save' || kind === 'send' || kind === 'export'
              ? 'bg-primary/50'
              : 'bg-gray-200 dark:bg-gray-500'
          "
        />
        <div
          class="h-1 w-4 rounded-[1px]"
          :class="
            kind === 'history' || kind === 'theme' || kind === 'locale'
              ? 'bg-primary/40'
              : 'bg-gray-200 dark:bg-gray-500'
          "
        />
        <div
          class="ml-auto h-1 w-3 rounded-[1px] bg-gray-200 dark:bg-gray-500"
        />
      </div>
      <div class="flex min-h-0 flex-1">
        <div
          class="flex w-3.5 shrink-0 flex-col gap-0.5 border-r border-gray-100 p-0.5 dark:border-gray-700"
        >
          <div
            class="h-1.5 w-full rounded-[1px]"
            :class="
              kind === 'custom' || kind === 'bookmark'
                ? 'bg-primary/50'
                : 'bg-gray-200 dark:bg-gray-500'
            "
          />
          <div
            class="h-1.5 w-full rounded-[1px] bg-gray-200 dark:bg-gray-500"
          />
          <div
            class="h-1.5 w-full rounded-[1px] bg-gray-200 dark:bg-gray-500"
          />
        </div>
        <div class="relative flex min-w-0 flex-1 flex-col gap-0.5 p-1">
          <div
            v-if="kind === 'tag' || kind === 'picker' || kind === 'sample'"
            class="flex items-center gap-0.5"
          >
            <div
              class="h-1.5 w-6 rounded-[1px] border border-dashed border-primary/50 bg-primary/15"
            />
            <div
              v-if="kind === 'picker'"
              class="absolute right-1 top-1 h-4 w-5 rounded-[2px] border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <div
              v-if="kind === 'sample'"
              class="ml-auto flex h-1.5 overflow-hidden rounded-[2px]"
            >
              <div class="w-3 bg-primary/50" />
              <div class="w-3 bg-gray-200 dark:bg-gray-500" />
            </div>
          </div>
          <div
            v-else-if="kind === 'resolve'"
            class="h-1.5 w-[70%] rounded-[1px] bg-gray-400 dark:bg-gray-400"
          />
          <div
            v-else-if="kind === 'logic'"
            class="h-1.5 w-5 rounded-[2px] bg-primary/40"
          />
          <div
            v-else-if="kind === 'media' || kind === 'import'"
            class="h-5 w-full rounded-[2px] bg-gray-200/80 dark:bg-gray-500/40"
          />
          <div
            v-else-if="kind === 'font'"
            class="h-2 w-6 rounded-[1px] bg-gray-400 dark:bg-gray-400"
          />
          <div v-else-if="kind === 'defaults'" class="flex gap-0.5">
            <div class="size-2 rounded-full bg-primary/50" />
            <div class="size-2 rounded-full bg-gray-300 dark:bg-gray-500" />
            <div class="size-2 rounded-full bg-gray-200 dark:bg-gray-600" />
          </div>
          <template v-else>
            <div
              class="h-1 w-[80%] rounded-[1px] bg-gray-200 dark:bg-gray-500"
            />
            <div
              class="h-1 w-[55%] rounded-[1px] bg-gray-200 dark:bg-gray-500"
            />
          </template>
          <div
            v-if="
              kind === 'comment' || kind === 'bookmark' || kind === 'condition'
            "
            class="absolute right-1 top-1 size-1.5 rounded-full bg-primary/70"
          />
        </div>
        <div
          v-if="kind === 'lint'"
          class="flex w-3.5 shrink-0 flex-col gap-0.5 border-l border-gray-100 p-0.5 dark:border-gray-700"
        >
          <div class="h-1.5 w-full rounded-[1px] bg-amber-400/70" />
          <div class="h-1 w-full rounded-[1px] bg-gray-200 dark:bg-gray-500" />
        </div>
      </div>
    </div>
  </div>
</template>
