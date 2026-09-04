<script setup lang="ts">
import { capabilityGroups } from "@/config/capabilities";

defineProps<{
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

// The registry is static for the life of the app, so this reads once rather
// than as a computed the rail would re-evaluate on every render for nothing.
const groups = capabilityGroups();
</script>

<template>
  <nav
    data-testid="capability-rail"
    aria-label="Capabilities"
    class="flex w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
  >
    <div
      v-for="group in groups"
      :key="group.group"
      data-testid="capability-rail-group"
    >
      <h2 class="pg-form-label px-2">{{ group.title }}</h2>
      <ul class="flex flex-col gap-0.5">
        <li v-for="capability in group.capabilities" :key="capability.id">
          <button
            type="button"
            data-testid="capability-rail-item"
            :aria-current="capability.id === activeId ? 'page' : undefined"
            class="w-full cursor-pointer rounded-md px-2 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            :class="
              capability.id === activeId
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100'
            "
            @click="emit('select', capability.id)"
          >
            {{ capability.title }}
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>
