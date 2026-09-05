<script setup lang="ts">
import { computed } from "vue";
import { renderConfig } from "@/config/render";

/**
 * Prints the object the shell handed to `init()` as TypeScript source.
 *
 * The shell keeps that exact object rather than rebuilding one to display,
 * so this pane cannot describe a config the editor never received — see the
 * `lastInitConfig` comment in `CapabilityShell.vue`.
 *
 * Plain monospace text: syntax highlighting means a second CodeMirror
 * instance alongside the template JSON editor's, which is its own task.
 */

const props = defineProps<{
  config: object | null;
}>();

const source = computed(() =>
  props.config === null ? "" : renderConfig(props.config),
);
</script>

<template>
  <div class="p-3">
    <p
      v-if="config === null"
      data-testid="capability-config-empty"
      class="m-0 text-[12px] text-gray-500 dark:text-gray-400"
    >
      The editor is still starting up — its config appears here once
      <code class="font-mono">init()</code> resolves.
    </p>
    <pre
      v-else
      data-testid="capability-config-source"
      class="m-0 overflow-x-auto font-mono text-[12px] leading-relaxed text-gray-800 dark:text-gray-200"
      >{{ source }}</pre>
  </div>
</template>
