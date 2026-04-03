<script setup lang="ts">
import { useI18n } from "../../composables";
import type { TemplateSnapshot } from "@templatical/types";
import { onClickOutside } from "@vueuse/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LoaderCircle,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  snapshots: TemplateSnapshot[];
  isLoading: boolean;
  isRestoring: boolean;
}>();

const emit = defineEmits<{
  (e: "load"): void;
  (e: "navigate", snapshot: TemplateSnapshot): void;
}>();

const { t, format } = useI18n();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// Track current position in snapshot history (0 = most recent)
const currentIndex = ref(-1);

// Reset index when snapshots change (e.g., after a save creates a new snapshot)
watch(
  () => props.snapshots.length,
  () => {
    currentIndex.value = -1;
  },
);

const canGoNewer = computed(() => {
  return (
    currentIndex.value > 0 && props.snapshots.length > 0 && !props.isRestoring
  );
});

const canGoOlder = computed(() => {
  return (
    currentIndex.value < props.snapshots.length - 1 &&
    props.snapshots.length > 0 &&
    !props.isRestoring
  );
});

function goNewer(): void {
  if (!canGoNewer.value) return;
  currentIndex.value--;
  emit("navigate", props.snapshots[currentIndex.value]);
}

function goOlder(): void {
  if (!canGoOlder.value) return;
  currentIndex.value++;
  emit("navigate", props.snapshots[currentIndex.value]);
}

function toggleDropdown(): void {
  isOpen.value = !isOpen.value;
  if (isOpen.value && props.snapshots.length === 0) {
    emit("load");
  }
}

function handleRestore(snapshotId: string): void {
  const index = props.snapshots.findIndex((s) => s.id === snapshotId);
  if (index !== -1) {
    currentIndex.value = index;
    emit("navigate", props.snapshots[index]);
  }
  isOpen.value = false;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t.snapshotHistory.justNow;
  if (minutes < 60) return format(t.snapshotHistory.minutesAgo, { minutes });
  if (hours < 24) return format(t.snapshotHistory.hoursAgo, { hours });
  if (days < 7) return format(t.snapshotHistory.daysAgo, { days });

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onClickOutside(dropdownRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <div
    ref="dropdownRef"
    class="tpl:relative tpl:flex tpl:items-center tpl:gap-0.5"
  >
    <!-- Go to older snapshot -->
    <button
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)] disabled:tpl:cursor-not-allowed disabled:tpl:opacity-30 disabled:hover:tpl:bg-transparent"
      style="color: var(--tpl-text-muted)"
      :disabled="!canGoOlder"
      :title="t.snapshotHistory.olderSnapshot"
      @click.stop="goOlder"
    >
      <ChevronLeft :size="14" :stroke-width="2" />
    </button>

    <!-- History dropdown toggle -->
    <button
      class="tpl:flex tpl:h-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-1.5 tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)]"
      style="color: var(--tpl-text-muted)"
      :title="t.snapshotHistory.tooltip"
      @click.stop="toggleDropdown"
    >
      <Clock :size="16" :stroke-width="1.5" />
      <ChevronDown
        class="tpl:transition-transform tpl:duration-150"
        :class="{ 'tpl:rotate-180': isOpen }"
        :size="10"
        :stroke-width="2"
      />
    </button>

    <Transition name="tpl-dropdown">
      <div
        v-if="isOpen"
        class="tpl-scale-in tpl:absolute tpl:top-full tpl:left-1/2 tpl:z-50 tpl:mt-2 tpl:w-72 tpl:-translate-x-1/2 tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)]"
        style="
          background-color: var(--tpl-bg-elevated);
          border: 1px solid var(--tpl-border);
          box-shadow: var(--tpl-shadow-lg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
      >
        <div
          class="tpl:border-b tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-semibold"
          style="color: var(--tpl-text); border-color: var(--tpl-border)"
        >
          {{ t.snapshotHistory.dropdownTitle }}
        </div>

        <div
          v-if="isLoading"
          class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8"
        >
          <LoaderCircle
            class="tpl:animate-spin"
            :size="20"
            :stroke-width="2"
            style="color: var(--tpl-primary)"
          />
        </div>

        <div
          v-else-if="snapshots.length === 0"
          class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs"
          style="color: var(--tpl-text-muted)"
        >
          {{ t.snapshotHistory.noSnapshots }}
        </div>

        <div v-else class="tpl:max-h-64 tpl:overflow-y-auto">
          <button
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:border-b tpl:border-l-2 tpl:border-l-transparent tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-all tpl:duration-150 last:tpl:border-b-0 hover:tpl:border-l-[var(--tpl-primary)] hover:tpl:bg-[var(--tpl-bg-hover)]"
            style="
              background-color: transparent;
              border-bottom-color: var(--tpl-border-light);
            "
            :disabled="isRestoring"
            @click="handleRestore(snapshot.id)"
          >
            <div class="tpl:flex tpl:flex-col tpl:gap-0.5">
              <div
                class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text)"
              >
                <span>{{ formatDate(snapshot.created_at) }}</span>
                <span
                  v-if="snapshot.is_autosave"
                  class="tpl:rounded tpl:px-1 tpl:py-0.5 tpl:text-[10px] tpl:font-normal"
                  style="
                    background-color: var(--tpl-bg-active);
                    color: var(--tpl-text-muted);
                  "
                >
                  {{ t.snapshotHistory.auto }}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Go to newer snapshot -->
    <button
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)] disabled:tpl:cursor-not-allowed disabled:tpl:opacity-30 disabled:hover:tpl:bg-transparent"
      style="color: var(--tpl-text-muted)"
      :disabled="!canGoNewer"
      :title="t.snapshotHistory.newerSnapshot"
      @click.stop="goNewer"
    >
      <ChevronRight :size="14" :stroke-width="2" />
    </button>
  </div>
</template>
