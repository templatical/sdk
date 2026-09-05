<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import type { CapabilityEvent } from "./useEventLog";

/**
 * The provider lifecycle events the editor has fired this session, newest
 * first.
 *
 * Every row is a real call the SDK made into a capability's provider — there
 * are no synthetic entries and no way to manufacture one, which is what makes
 * the feed evidence rather than illustration. Each capability writes its own
 * summary inside `build()`, because only it knows what its payload means.
 */

// The shell binds one merged object across every tab rather than a branch per
// tab, so this pane is handed the other panes' props and handlers too.
// Without this they would land on the root element as `[object Object]`
// attributes and as listeners for events nothing dispatches.
defineOptions({ inheritAttrs: false });

defineProps<{
  events: CapabilityEvent[];
}>();

const emit = defineEmits<{
  clear: [];
}>();

/**
 * A relative label needs something to recompute against, and this feed's
 * newest row is usually seconds old — so it ticks once a second rather than
 * on the minute. Reading `now` inside `relativeTime` is what makes each row
 * a dependency of it; without that the labels are stamped once and sit there
 * claiming "just now" for the rest of the session.
 */
const now = ref(Date.now());
const tick = window.setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => window.clearInterval(tick));

function relativeTime(at: number): string {
  const seconds = Math.max(0, Math.round((now.value - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** The exact moment, for the row's tooltip — the relative label rounds. */
function absoluteTime(at: number): string {
  return new Date(at).toLocaleTimeString();
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex items-start justify-between gap-4 border-b border-gray-200 p-3 dark:border-gray-700"
    >
      <p
        data-testid="events-remote-note"
        class="m-0 text-[12px] text-gray-500 dark:text-gray-400"
      >
        Every event below is <code class="font-mono">local</code> — this browser
        caused it. A <code class="font-mono">remote</code> event reaches the
        editor only through a provider's
        <code class="font-mono">subscribe</code>, carrying a change another
        session made, and this demo runs in one browser with no transport behind
        it.
      </p>
      <button
        type="button"
        data-testid="events-clear"
        class="pg-toolbar-btn shrink-0"
        :disabled="events.length === 0"
        @click="emit('clear')"
      >
        Clear
      </button>
    </div>

    <p
      v-if="events.length === 0"
      data-testid="events-empty"
      class="m-0 p-3 text-[12px] text-gray-500 dark:text-gray-400"
    >
      Nothing yet. Use the editor above — save a block, save the template — and
      each handler the SDK calls lands here.
    </p>

    <ul v-else class="m-0 list-none p-0">
      <li
        v-for="event in events"
        :key="event.id"
        data-testid="capability-event"
        :data-event-handler="event.handler"
        :data-event-capability="event.capabilityId"
        :data-event-origin="event.origin"
        class="flex items-baseline gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-700"
      >
        <code
          class="shrink-0 font-mono text-[12px] font-medium text-gray-900 dark:text-gray-100"
        >
          {{ event.capabilityId }}.{{ event.handler }}
        </code>
        <span
          class="min-w-0 flex-1 truncate text-[12px] text-gray-600 dark:text-gray-300"
        >
          {{ event.summary }}
        </span>
        <span
          class="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400"
        >
          {{ event.origin }}
        </span>
        <span
          class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500"
          :title="absoluteTime(event.at)"
        >
          {{ relativeTime(event.at) }}
        </span>
      </li>
    </ul>
  </div>
</template>
