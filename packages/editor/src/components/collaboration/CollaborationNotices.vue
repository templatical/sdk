<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed } from "vue";
import type {
  CollaborationNoticeView,
  UseCollaborationFeatureReturn,
} from "../../composables/useCollaborationFeature";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{
  feature: UseCollaborationFeatureReturn;
}>();

const { t, format } = useI18n();

const notice = computed(() => props.feature.notices.value.at(-1) ?? null);

/** Shown for as long as the socket is down; edits keep going over HTTP. */
const isReconnecting = computed(
  () =>
    props.feature.connection.value === "reconnecting" ||
    props.feature.connection.value === "offline",
);

/**
 * Refusals warn; an agent's or the AI's edit is information, so it takes
 * Compositor Teal. Amber stays for selection and intent.
 */
const tone = computed(() =>
  notice.value?.kind === "agentEdited" || notice.value?.kind === "aiEdited"
    ? "info"
    : "warning",
);
const TONE_STYLES = {
  warning: {
    backgroundColor: "var(--tpl-warning-light)",
    color: "var(--tpl-text)",
    border: "1px solid var(--tpl-warning)",
  },
  info: {
    backgroundColor: "var(--tpl-secondary-light)",
    color: "var(--tpl-text)",
    border: "1px solid var(--tpl-secondary)",
  },
} as const;

function nameOf(person: { name?: string; isGuest?: boolean }): string {
  return person.isGuest || !person.name ? t.collaboration.guest : person.name;
}

/**
 * "{who} changed …", where `who` is "Claude for Ada" or "AI (for Ada)": an
 * updated template wins, then blocks with settings.
 */
function agentMessage(
  view: Extract<CollaborationNoticeView, { kind: "agentEdited" | "aiEdited" }>,
): string {
  const who =
    view.kind === "aiEdited"
      ? format(t.collaboration.aiFor, { name: nameOf(view) })
      : format(t.collaboration.agentFor, {
          client: view.client ?? t.collaboration.anAgent,
          name: nameOf(view),
        });
  const values = { who, count: view.blocks };
  if (view.templateUpdated)
    return format(t.collaboration.agentUpdatedTemplate, values);
  if (view.settings && view.blocks > 1)
    return format(t.collaboration.agentChangedBlocksAndSettings, values);
  if (view.settings && view.blocks === 1)
    return format(t.collaboration.agentChangedBlockAndSettings, values);
  if (view.settings)
    return format(t.collaboration.agentChangedSettings, values);
  if (view.blocks === 1)
    return format(t.collaboration.agentChangedBlock, values);
  return format(t.collaboration.agentChangedBlocks, values);
}

function message(view: CollaborationNoticeView): string {
  switch (view.kind) {
    case "selectionRefused":
      return format(t.collaboration.selectionRefused, { name: nameOf(view) });
    case "editRefused":
      if (view.code === "content_too_large")
        return t.collaboration.editTooLarge;
      return view.code === "lock_held" && (view.name || view.isGuest)
        ? format(t.collaboration.editRefusedLocked, { name: nameOf(view) })
        : t.collaboration.editRefused;
    case "undoSkipped":
      return t.collaboration.undoSkipped;
    case "replaceRefused":
      return format(t.collaboration.replaceRefused, {
        names: view.holders.map(nameOf).join(", "),
      });
    case "agentEdited":
    case "aiEdited":
      return agentMessage(view);
  }
}
</script>

<template>
  <div
    class="tpl:pointer-events-none tpl:absolute tpl:top-16 tpl:left-1/2 tpl:z-[60] tpl:flex tpl:-translate-x-1/2 tpl:flex-col tpl:items-center tpl:gap-2"
  >
    <div
      v-if="isReconnecting"
      data-testid="collaboration-notice"
      data-kind="reconnecting"
      data-tone="warning"
      role="status"
      aria-live="polite"
      class="tpl:pointer-events-auto tpl:rounded-[var(--tpl-radius)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:shadow-[var(--tpl-shadow-lg)]"
      :style="TONE_STYLES.warning"
    >
      {{ t.collaboration.reconnectingNotice }}
    </div>
    <!-- `message()` is interpolated, never `v-html`: an agent's name comes
         from its own registration and is untrusted text. -->
    <div
      v-if="notice"
      :key="notice.id"
      data-testid="collaboration-notice"
      :data-kind="notice.kind"
      :data-tone="tone"
      role="status"
      aria-live="polite"
      class="tpl:pointer-events-auto tpl:flex tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:shadow-[var(--tpl-shadow-lg)]"
      :style="TONE_STYLES[tone]"
    >
      <span>{{ message(notice) }}</span>
      <button
        type="button"
        class="tpl:flex tpl:size-5 tpl:items-center tpl:justify-center tpl:rounded tpl:text-[var(--tpl-text-muted)] tpl:hover:text-[var(--tpl-text)]"
        :aria-label="t.collaboration.dismiss"
        :title="t.collaboration.dismiss"
        @click="feature.dismissNotice(notice.id)"
      >
        <X :size="14" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
