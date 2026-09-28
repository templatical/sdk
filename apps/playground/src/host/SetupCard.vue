<script setup lang="ts">
import { computed, inject, onMounted, ref, shallowRef, type Ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { ArrowUpRight, Copy, MonitorSmartphone } from "@lucide/vue";
import type { CodeTheme, HighlightedToken } from "@/host/codeHighlight";
import { codeSpans } from "@/host/catalogNav";
import type { Proof } from "@/host/proofs";
import { usePlaygroundI18n } from "@/i18n";

/**
 * A scene on a phone: the setup as text and code, in place of an editor that
 * would cover itself with its small-screen notice.
 */
const props = defineProps<{
  title: string;
  seeIt: string;
  snippet: string;
  docsHref: string;
  /** An example's captured email. */
  proof?: Proof;
  proofAlt?: string;
}>();

const { t } = usePlaygroundI18n();
const isDark = inject<Ref<boolean>>("isDark", ref(false));
const { copy, copied } = useClipboard({ copiedDuring: 1600, legacy: true });

/**
 * Highlighted as the home page and the Code drawer highlight it. The grammar
 * loads after first paint, so the snippet renders plain until the colours land.
 */
const highlight = shallowRef<
  ((code: string, theme: CodeTheme) => HighlightedToken[]) | null
>(null);
const tokens = computed<HighlightedToken[]>(() =>
  highlight.value
    ? highlight.value(props.snippet, isDark.value ? "dark" : "light")
    : [{ text: props.snippet }],
);

onMounted(() => {
  void import("@/host/codeHighlight").then((module) => {
    highlight.value = module.highlightJs;
  });
});
</script>

<template>
  <div
    data-testid="setup-card-screen"
    class="flex-1 bg-gray-100 p-[15px] dark:bg-gray-800"
  >
    <article
      data-testid="setup-card"
      class="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <header>
        <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1
            class="m-0 text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100"
          >
            {{ title }}
          </h1>
          <slot name="init-key" />
        </div>
        <p
          data-testid="setup-card-see-it"
          class="m-0 mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
        >
          <template v-for="(part, i) in codeSpans(seeIt)" :key="i"
            ><code v-if="part.code" class="font-mono text-[0.92em]">{{
              part.text
            }}</code
            ><template v-else>{{ part.text }}</template></template
          >
        </p>
      </header>

      <div
        v-if="proof"
        class="pg-proof-tile aspect-[3/4] overflow-hidden rounded-[7px] border border-gray-200 bg-white dark:border-gray-700"
      >
        <img
          data-testid="setup-card-proof"
          :src="proof.src"
          :width="proof.width"
          :height="proof.height"
          :alt="proofAlt ?? ''"
          decoding="async"
          class="block h-auto w-full"
        />
      </div>

      <!-- The Code drawer's shape: the copy button sits in a bar above the
           code, since the code scrolls sideways on a phone and a button over
           it would cover the text. -->
      <section
        :aria-label="t.host.snippet"
        class="min-w-0 overflow-hidden rounded-[10px] border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          class="flex h-11 items-center justify-between gap-3 border-b border-gray-200 pl-3.5 pr-1.5 dark:border-gray-700"
        >
          <h2
            class="m-0 text-[13px] font-semibold text-gray-900 dark:text-gray-100"
          >
            {{ t.host.snippet }}
          </h2>
          <button
            type="button"
            data-testid="setup-card-copy"
            class="pg-toolbar-btn"
            @click="copy(snippet)"
          >
            <Copy :size="14" :stroke-width="1.75" aria-hidden="true" />
            {{ copied ? t.exportModal.copied : t.exportModal.copy }}
          </button>
        </div>
        <pre
          data-testid="setup-card-snippet"
          class="m-0 overflow-x-auto px-3.5 py-3 font-mono text-xs leading-relaxed text-gray-900 dark:text-gray-100"
        ><code><span
          v-for="(token, index) in tokens"
          :key="index"
          :style="token.color ? { color: token.color } : undefined"
        >{{ token.text }}</span></code></pre>
      </section>

      <a
        :href="docsHref"
        data-testid="setup-card-docs"
        target="_blank"
        rel="noopener noreferrer"
        class="pg-toolbar-link -ml-2 self-start"
      >
        {{ t.host.docs }}
        <ArrowUpRight :size="14" :stroke-width="1.75" aria-hidden="true" />
      </a>

      <p
        data-testid="setup-card-wider-screen"
        class="m-0 flex items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <MonitorSmartphone
          :size="16"
          :stroke-width="1.5"
          class="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        {{ t.host.phone.widerScreen }}
      </p>
    </article>
  </div>
</template>
