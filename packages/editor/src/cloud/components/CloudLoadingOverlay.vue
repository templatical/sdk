<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();
</script>

<template>
  <div
    v-if="visible"
    class="tpl-loading tpl:absolute tpl:inset-0 tpl:z-overlay tpl:flex tpl:flex-col"
    style="background-color: var(--tpl-bg)"
  >
    <!-- Skeleton header -->
    <div
      class="tpl:flex tpl:h-14 tpl:shrink-0 tpl:items-center tpl:justify-between tpl:px-4"
      style="border-bottom: 1px solid var(--tpl-border)"
    >
      <div
        class="tpl-shimmer tpl:h-5 tpl:w-28 tpl:rounded-[var(--tpl-radius-sm)]"
      ></div>
      <div class="tpl:flex tpl:gap-3">
        <div
          class="tpl-shimmer tpl:h-8 tpl:w-20 tpl:rounded-[var(--tpl-radius-sm)]"
        ></div>
        <div
          class="tpl-shimmer tpl:h-8 tpl:w-20 tpl:rounded-[var(--tpl-radius-sm)]"
        ></div>
      </div>
    </div>
    <!-- Skeleton body -->
    <div class="tpl:flex tpl:flex-1 tpl:overflow-hidden">
      <!-- Left sidebar rail -->
      <div
        class="tpl:flex tpl:w-12 tpl:shrink-0 tpl:flex-col tpl:items-center tpl:gap-4 tpl:py-5"
        style="border-right: 1px solid var(--tpl-border)"
      >
        <div
          v-for="n in 5"
          :key="n"
          class="tpl-shimmer tpl:size-7 tpl:rounded-[var(--tpl-radius-sm)]"
        ></div>
      </div>
      <!-- Canvas area -->
      <div
        class="tpl:flex tpl:flex-1 tpl:items-start tpl:justify-center tpl:overflow-auto tpl:p-8"
        style="background-color: var(--tpl-canvas-bg)"
      >
        <div
          class="tpl:w-full tpl:max-w-[600px] tpl:rounded-[var(--tpl-radius)] tpl:p-6"
          style="
            background-color: var(--tpl-bg);
            box-shadow: var(--tpl-shadow-sm);
          "
        >
          <div class="tpl:space-y-2 tpl:py-4">
            <div class="tpl-shimmer tpl:h-3 tpl:w-3/4 tpl:rounded"></div>
            <div class="tpl-shimmer tpl:h-3 tpl:w-full tpl:rounded"></div>
            <div class="tpl-shimmer tpl:h-3 tpl:w-5/6 tpl:rounded"></div>
          </div>
          <div class="tpl:py-4">
            <div
              class="tpl-shimmer tpl:h-44 tpl:w-full tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
          </div>
          <div class="tpl:space-y-2 tpl:py-4">
            <div class="tpl-shimmer tpl:h-3 tpl:w-full tpl:rounded"></div>
            <div class="tpl-shimmer tpl:h-3 tpl:w-2/3 tpl:rounded"></div>
          </div>
          <div class="tpl:flex tpl:justify-center tpl:py-4">
            <div
              class="tpl-shimmer tpl:h-10 tpl:w-36 tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
          </div>
          <div class="tpl:space-y-2 tpl:py-4">
            <div
              class="tpl-shimmer tpl:mx-auto tpl:h-2.5 tpl:w-1/2 tpl:rounded"
            ></div>
            <div
              class="tpl-shimmer tpl:mx-auto tpl:h-2.5 tpl:w-1/3 tpl:rounded"
            ></div>
          </div>
        </div>
      </div>
      <!-- Right panel -->
      <div
        class="tpl:flex tpl:w-[320px] tpl:shrink-0 tpl:flex-col tpl:gap-4 tpl:p-4"
        style="border-left: 1px solid var(--tpl-border)"
      >
        <div
          class="tpl-shimmer tpl:h-8 tpl:rounded-[var(--tpl-radius-sm)]"
        ></div>
        <div
          class="tpl-shimmer tpl:h-32 tpl:rounded-[var(--tpl-radius)]"
        ></div>
        <div
          class="tpl-shimmer tpl:h-32 tpl:rounded-[var(--tpl-radius)]"
        ></div>
      </div>
    </div>
  </div>
</template>
