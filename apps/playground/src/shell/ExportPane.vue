<script setup lang="ts">
import { ref, watch } from "vue";
import type { TemplaticalEditor } from "@templatical/editor";

/**
 * Runs the live editor's `toMjml()` / `toHtml()` and shows what came back.
 *
 * `render`'s only observable effect is whether `toHtml()` resolves — with no
 * `render` provider configured it rejects, naming the missing compiler
 * (`packages/editor/src/index.ts`: `toHtml()` tries `render.toHtml`, then
 * `toMjml()` plus `render.compileMjml`, then throws). A Run button rather
 * than rendering on mount: a provider's `compileMjml` can lazy-load its own
 * dependencies on first call, and a tab that pays that cost on open would
 * make switching tabs feel broken.
 *
 * Plain monospace text, like the Config tab — a second syntax-highlighted
 * read-only view is its own task.
 */

// The shell binds one merged object across every tab rather than a branch
// per tab, so this pane is handed the other panes' props too. Without this
// they would land on the root element as `[object Object]` attributes.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  editor: TemplaticalEditor | null;
}>();

const mjml = ref("");
const html = ref("");
const error = ref("");
const hasRun = ref(false);
const isRunning = ref(false);

// A re-init means the previous output describes an editor that no longer
// exists — an editor identity change resets all three rather than leaving a
// stale export sitting under a fresh instance.
watch(
  () => props.editor,
  () => {
    mjml.value = "";
    html.value = "";
    error.value = "";
    hasRun.value = false;
  },
);

async function run(): Promise<void> {
  const editor = props.editor;
  if (!editor || isRunning.value) return;

  isRunning.value = true;
  hasRun.value = true;
  error.value = "";

  // Awaited independently, each in its own try/catch: a `toHtml()` rejection
  // must still leave the MJML that succeeded on screen rather than clearing
  // it, and a `toMjml()` failure must not be masked by `toHtml()`'s own
  // (composed) rejection.
  try {
    mjml.value = await editor.toMjml();
  } catch (err) {
    mjml.value = "";
    error.value = err instanceof Error ? err.message : String(err);
  }

  try {
    html.value = await editor.toHtml();
  } catch (err) {
    html.value = "";
    // The SDK's own message, verbatim — it names exactly what is missing,
    // and paraphrasing it is exactly what this tab exists to avoid.
    error.value = err instanceof Error ? err.message : String(err);
  }

  isRunning.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-3 p-3">
    <div class="flex items-center justify-between gap-4">
      <p class="m-0 text-[12px] text-gray-500 dark:text-gray-400">
        Runs the live editor's
        <code class="font-mono">toMjml()</code> and
        <code class="font-mono">toHtml()</code>.
      </p>
      <button
        type="button"
        data-testid="export-run"
        class="pg-toolbar-btn shrink-0"
        :disabled="!editor || isRunning"
        @click="run"
      >
        Run
      </button>
    </div>

    <p
      v-if="!hasRun"
      data-testid="export-empty"
      class="m-0 text-[12px] text-gray-500 dark:text-gray-400"
    >
      Press Run to render the live template.
    </p>

    <template v-else>
      <p
        v-if="error"
        data-testid="export-error"
        class="m-0 text-[12px] font-medium text-amber-600 dark:text-amber-500"
      >
        {{ error }}
      </p>

      <div class="flex min-h-0 flex-col gap-1">
        <span class="text-[12px] font-medium text-gray-900 dark:text-gray-100"
          >MJML</span
        >
        <pre
          data-testid="export-mjml"
          class="m-0 max-h-40 overflow-x-auto overflow-y-auto font-mono text-[12px] leading-relaxed text-gray-800 dark:text-gray-200"
          >{{ mjml }}</pre>
      </div>

      <div class="flex min-h-0 flex-col gap-1">
        <span class="text-[12px] font-medium text-gray-900 dark:text-gray-100"
          >HTML</span
        >
        <pre
          data-testid="export-html"
          class="m-0 max-h-40 overflow-x-auto overflow-y-auto font-mono text-[12px] leading-relaxed text-gray-800 dark:text-gray-200"
          >{{ html }}</pre>
      </div>
    </template>
  </div>
</template>
