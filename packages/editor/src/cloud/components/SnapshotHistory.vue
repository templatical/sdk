<script setup lang="ts">
import { useI18n } from "../../composables";
import { useCloudI18nStrict } from "../../composables";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
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

const { format } = useI18n();
const { t: cloudT } = useCloudI18nStrict();

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
  const result = formatRelativeTime(
    dateString,
    cloudT.snapshotHistory,
    format,
    7,
  );
  if (result !== null) return result;

  return new Date(dateString).toLocaleDateString(undefined, {
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
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)] disabled:tpl:cursor-not-allowed disabled:tpl:opacity-30 disabled:hover:tpl:bg-transparent tpl:text-[var(--tpl-text-muted)]"
      :disabled="!canGoOlder"
      :title="cloudT.snapshotHistory.olderSnapshot"
      @click.stop="goOlder"
    >
      <ChevronLeft :size="14" :stroke-width="2" />
    </button>

    <!-- History dropdown toggle -->
    <button
      class="tpl:flex tpl:h-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-1.5 tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
      :title="cloudT.snapshotHistory.tooltip"
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
        class="tpl-scale-in tpl:absolute tpl:top-full tpl:left-1/2 tpl:z-50 tpl:mt-2 tpl:w-72 tpl:-translate-x-1/2 tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg-elevated)] tpl:border tpl:border-[var(--tpl-border)] tpl:shadow-[var(--tpl-shadow-lg)]"
        style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px)"
      >
        <div
          class="tpl:border-b tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)] tpl:border-[var(--tpl-border)]"
        >
          {{ cloudT.snapshotHistory.dropdownTitle }}
        </div>

        <div
          v-if="isLoading"
          class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8"
        >
          <LoaderCircle
            class="tpl:animate-spin tpl:text-[var(--tpl-primary)]"
            :size="20"
            :stroke-width="2"
          />
        </div>

        <div
          v-else-if="snapshots.length === 0"
          class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
        >
          {{ cloudT.snapshotHistory.noSnapshots }}
        </div>

        <div v-else class="tpl:max-h-64 tpl:overflow-y-auto">
          <button
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:border-b tpl:border-b-[var(--tpl-border-light)] tpl:border-l-2 tpl:border-l-transparent tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-all tpl:duration-150 last:tpl:border-b-0 hover:tpl:border-l-[var(--tpl-primary)] hover:tpl:bg-[var(--tpl-bg-hover)]"
            style="background-color: transparent"
            :disabled="isRestoring"
            @click="handleRestore(snapshot.id)"
          >
            <div class="tpl:flex tpl:flex-col tpl:gap-0.5">
              <div
                class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
              >
                <span>{{ formatDate(snapshot.created_at) }}</span>
                <span
                  v-if="snapshot.is_autosave"
                  class="tpl:rounded tpl:px-1 tpl:py-0.5 tpl:text-[10px] tpl:font-normal tpl:bg-[var(--tpl-bg-active)] tpl:text-[var(--tpl-text-muted)]"
                >
                  {{ cloudT.snapshotHistory.auto }}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Go to newer snapshot -->
    <button
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:duration-150 hover:tpl:bg-[var(--tpl-bg-hover)] disabled:tpl:cursor-not-allowed disabled:tpl:opacity-30 disabled:hover:tpl:bg-transparent tpl:text-[var(--tpl-text-muted)]"
      :disabled="!canGoNewer"
      :title="cloudT.snapshotHistory.newerSnapshot"
      @click.stop="goNewer"
    >
      <ChevronRight :size="14" :stroke-width="2" />
    </button>
  </div>
</template>
