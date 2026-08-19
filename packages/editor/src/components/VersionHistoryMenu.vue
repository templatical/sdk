<script setup lang="ts">
/**
 * The header's version-history control: step older / newer through the list, or
 * open the dropdown and jump straight to one.
 *
 * Shared by both editors — it was `cloud/components/SnapshotHistory.vue` and
 * spoke Cloud's wire shape (`created_at`, `is_autosave`) directly. It now reads
 * the `TemplateVersion` contract, so any provider drives it.
 */
import { computed, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LoaderCircle,
} from "@lucide/vue";
import type { TemplateVersion } from "@templatical/types";
import { useI18n } from "../composables/useI18n";
import { formatRelativeTime } from "../utils/formatRelativeTime";

const props = defineProps<{
  versions: TemplateVersion[];
  isLoading: boolean;
  isRestoring: boolean;
  /** Which version is on the canvas, or `null` while editing normally. */
  previewingId: string | null;
}>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "navigate", version: TemplateVersion): void;
}>();

const { t, format } = useI18n();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

/**
 * Position in the list (0 = newest), derived from what is actually previewed
 * rather than tracked locally. A local index went stale the moment the user
 * cancelled a preview — the arrows then stepped from wherever they had left off
 * instead of from the top.
 */
const currentIndex = computed(() =>
  props.previewingId === null
    ? -1
    : props.versions.findIndex((v) => v.id === props.previewingId),
);

const canGoNewer = computed(
  () => currentIndex.value > 0 && !props.isRestoring && !props.isLoading,
);

const canGoOlder = computed(
  () =>
    currentIndex.value < props.versions.length - 1 &&
    props.versions.length > 0 &&
    !props.isRestoring &&
    !props.isLoading,
);

function goNewer(): void {
  if (!canGoNewer.value) return;
  emit("navigate", props.versions[currentIndex.value - 1]);
}

function goOlder(): void {
  if (!canGoOlder.value) return;
  emit("navigate", props.versions[currentIndex.value + 1]);
}

function toggleDropdown(): void {
  isOpen.value = !isOpen.value;
  // Always on open, never only when empty: history grows behind the user's back
  // (every save may record one), so a list fetched once would go stale silently.
  if (isOpen.value) emit("open");
}

function selectVersion(version: TemplateVersion): void {
  emit("navigate", version);
  isOpen.value = false;
}

function formatDate(dateString: string): string {
  const result = formatRelativeTime(
    dateString,
    t.versionHistory.time,
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
    data-testid="version-history"
  >
    <!-- Step to an older version -->
    <button
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-30 tpl:disabled:hover:bg-transparent tpl:text-[var(--tpl-text-muted)]"
      data-testid="version-history-older"
      :disabled="!canGoOlder"
      :title="t.versionHistory.olderVersion"
      :aria-label="t.versionHistory.olderVersion"
      @click.stop="goOlder"
    >
      <ChevronLeft :size="14" :stroke-width="2" />
    </button>

    <!-- History dropdown toggle -->
    <button
      class="tpl:flex tpl:h-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-1.5 tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
      data-testid="version-history-toggle"
      :aria-expanded="isOpen"
      :title="t.versionHistory.tooltip"
      :aria-label="t.versionHistory.tooltip"
      @click.stop="toggleDropdown"
    >
      <Clock :size="16" :stroke-width="1.5" />
      <ChevronDown
        class="tpl:transition-transform"
        :class="{ 'tpl:rotate-180': isOpen }"
        :size="10"
        :stroke-width="2"
      />
    </button>

    <Transition name="tpl-dropdown">
      <div
        v-if="isOpen"
        class="tpl-scale-in tpl:absolute tpl:top-full tpl:left-1/2 tpl:z-50 tpl:mt-2 tpl:w-72 tpl:-translate-x-1/2 tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg-elevated)] tpl:border tpl:border-[var(--tpl-border)] tpl:shadow-[var(--tpl-shadow-lg)]"
        data-testid="version-history-dropdown"
        style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px)"
      >
        <div
          class="tpl:border-b tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)] tpl:border-[var(--tpl-border)]"
        >
          {{ t.versionHistory.dropdownTitle }}
        </div>

        <div
          v-if="isLoading && versions.length === 0"
          class="tpl:flex tpl:items-center tpl:justify-center tpl:py-8"
          role="status"
          aria-busy="true"
        >
          <LoaderCircle
            class="tpl:animate-spin tpl:text-[var(--tpl-primary)]"
            :size="20"
            :stroke-width="2"
          />
        </div>

        <div
          v-else-if="versions.length === 0"
          class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
          data-testid="version-history-empty"
        >
          {{ t.versionHistory.empty }}
        </div>

        <div v-else class="tpl:max-h-64 tpl:overflow-y-auto">
          <button
            v-for="version in versions"
            :key="version.id"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:border-b tpl:border-b-[var(--tpl-border-light)] tpl:border-l-2 tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-all tpl:last:border-b-0 tpl:hover:border-l-[var(--tpl-primary)] tpl:hover:bg-[var(--tpl-bg-hover)]"
            :class="
              version.id === previewingId
                ? 'tpl:border-l-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg-active)]'
                : 'tpl:border-l-transparent'
            "
            style="background-color: transparent"
            data-testid="version-history-entry"
            :data-version-id="version.id"
            :disabled="isRestoring"
            @click="selectVersion(version)"
          >
            <div class="tpl:flex tpl:flex-col tpl:gap-0.5">
              <div
                class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
              >
                <span>{{
                  version.label ?? formatDate(version.createdAt)
                }}</span>
                <span
                  v-if="version.isAutomatic"
                  class="tpl:rounded tpl:px-1 tpl:py-0.5 tpl:text-[10px] tpl:font-normal tpl:bg-[var(--tpl-bg-active)] tpl:text-[var(--tpl-text-muted)]"
                >
                  {{ t.versionHistory.auto }}
                </span>
              </div>
              <!-- A labelled version still shows when it was taken, and by whom
                   if the store tracks that; an unlabelled one already leads with
                   the date, so the line would repeat it. -->
              <div
                v-if="version.label || version.author?.name"
                class="tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >
                <template v-if="version.label">{{
                  formatDate(version.createdAt)
                }}</template>
                <template v-if="version.label && version.author?.name">
                  ·
                </template>
                <template v-if="version.author?.name">{{
                  version.author.name
                }}</template>
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Step to a newer version -->
    <button
      class="tpl:flex tpl:size-7 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-30 tpl:disabled:hover:bg-transparent tpl:text-[var(--tpl-text-muted)]"
      data-testid="version-history-newer"
      :disabled="!canGoNewer"
      :title="t.versionHistory.newerVersion"
      :aria-label="t.versionHistory.newerVersion"
      @click.stop="goNewer"
    >
      <ChevronRight :size="14" :stroke-width="2" />
    </button>
  </div>
</template>
