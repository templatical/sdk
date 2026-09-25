<script setup lang="ts">
import { Monitor, Sun, Moon } from "@lucide/vue";
import {
  usePlaygroundI18n,
  usePlaygroundTheme,
  supportedLocales,
} from "@/i18n";

const { locale, t } = usePlaygroundI18n();
const { theme: uiTheme } = usePlaygroundTheme();

function cycleTheme(): void {
  const cycle = { auto: "light", light: "dark", dark: "auto" } as const;
  uiTheme.value = cycle[uiTheme.value];
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      class="pg-theme-btn"
      data-testid="toolbar-theme"
      :title="t.theme[uiTheme]"
      :aria-label="t.a11y.selectTheme"
      @click="cycleTheme"
    >
      <Monitor v-if="uiTheme === 'auto'" :size="14" aria-hidden="true" />
      <Sun v-else-if="uiTheme === 'light'" :size="14" aria-hidden="true" />
      <Moon v-else :size="14" aria-hidden="true" />
    </button>
    <select
      v-model="locale"
      data-testid="locale-select"
      :aria-label="t.a11y.selectLanguage"
      class="pg-locale-select"
    >
      <option v-for="loc in supportedLocales" :key="loc" :value="loc">
        {{ loc.toUpperCase() }}
      </option>
    </select>
  </div>
</template>
