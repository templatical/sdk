<script setup lang="ts">
import { computed } from "vue";
import { compareUrl, shortCommit } from "@/host/buildInfo";
import { format, usePlaygroundI18n } from "@/i18n";

const { t } = usePlaygroundI18n();

const info = __PG_BUILD_INFO__;
const href = compareUrl(info);
const commit = info.commit ? shortCommit(info.commit) : "";
const commitLabel = computed(() =>
  format(t.value.buildInfo.compare, { commit, version: info.version }),
);
</script>

<template>
  <p
    data-testid="build-info"
    class="m-0 text-[11px] text-gray-500 tabular-nums dark:text-gray-400"
  >
    {{ format(t.buildInfo.label, { version: info.version }) }}
    <template v-if="href">
      ·
      <a
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="build-info-commit"
        :title="commitLabel"
        :aria-label="commitLabel"
        class="font-mono text-gray-600 no-underline underline-offset-2 hover:text-gray-900 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-300 dark:hover:text-gray-100"
        >{{ commit }}</a
      >
    </template>
  </p>
</template>
