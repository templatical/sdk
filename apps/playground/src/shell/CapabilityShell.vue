<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { init, type TemplaticalEditor } from "@templatical/editor";
import {
  buildAllCapabilityConfig,
  capabilityById,
} from "@/config/capabilities";
import { readControlState } from "@/config/state";
import { slugFor } from "@/providers/template-name";
import { templates } from "@/templates";
import CapabilityRail from "./CapabilityRail.vue";
import { useCapabilityRoute } from "./useCapabilityRoute";

const { activeId, select } = useCapabilityRoute();

// `activeId` only ever holds a registered id — `parseCapabilityHash` (inside
// `useCapabilityRoute`) falls back to the first registered capability for
// anything else — so this lookup can't miss.
const capability = computed(() => capabilityById(activeId.value)!);

// Every registered capability names "product-launch" today; a future one
// naming a fixture no template carries falls back to the first template
// rather than mounting an editor with no content at all.
const fixture = computed(
  () =>
    templates.find((t) => slugFor(t.name) === capability.value.fixture) ??
    templates[0],
);

const editorHost = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalEditor | null>(null);

// Navigating away from #capabilities while `init()` is in flight must not
// mount a fresh editor after teardown: `onBeforeUnmount` tears down whatever
// `editor.value` holds at that moment, and assigning past it would land a new
// instance in a detached host with nothing left to unmount it. Set on
// unmount, checked after the one await below.
let destroyed = false;

async function initEditor(): Promise<void> {
  if (!editorHost.value) return;
  editor.value?.unmount();
  const instance = await init({
    container: editorHost.value,
    content: fixture.value.create(),
    // `App.vue` also passes locale, theme, uiTheme, fonts, merge-tag request
    // handlers, test email and a dozen other keys. Those belong to
    // capabilities plans 5a-5d haven't ported yet — each arrives here as its
    // capability lands, so this shell only owns what the registry already
    // produces.
    ...buildAllCapabilityConfig(readControlState(), fixture.value),
  });
  if (destroyed) {
    instance.unmount();
    return;
  }
  editor.value = instance;
}

onMounted(async () => {
  await initEditor();
});

// A rail click or a direct link to a different `#capabilities/<id>` moves
// `activeId`. Re-running `initEditor` swaps the fixture and config into the
// SAME host element rather than remounting the component tree around it.
watch(activeId, async () => {
  await initEditor();
});

onBeforeUnmount(() => {
  destroyed = true;
  editor.value?.unmount();
});
</script>

<template>
  <div data-testid="capability-shell" class="flex h-screen dark:bg-gray-900">
    <CapabilityRail :active-id="activeId" @select="select" />
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="shrink-0 border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <h1
          class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {{ capability.title }}
        </h1>
        <p
          data-testid="capability-blurb"
          class="m-0 mt-1 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ capability.blurb }}
        </p>
      </header>
      <main
        class="relative flex min-h-0 flex-1 bg-gray-100 p-[15px] dark:bg-gray-800"
      >
        <div
          ref="editorHost"
          data-testid="capability-editor"
          class="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </main>
    </div>
  </div>
</template>
