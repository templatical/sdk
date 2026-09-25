<script setup lang="ts">
import { Monitor, Moon, Settings2, Sun } from "@lucide/vue";
import { onClickOutside } from "@vueuse/core";
import { nextTick, ref, useId } from "vue";
import {
  supportedLocales,
  usePlaygroundI18n,
  usePlaygroundTheme,
} from "@/i18n";

const { locale, t } = usePlaygroundI18n();
const { theme: uiTheme } = usePlaygroundTheme();

const THEMES = [
  { value: "auto", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const panelId = useId();
const localeId = useId();

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (!open.value) return;
  await nextTick();
  root.value
    ?.querySelector<HTMLInputElement>('input[name="pg-theme"]:checked')
    ?.focus();
}

function close(returnFocus: boolean): void {
  if (!open.value) return;
  open.value = false;
  if (returnFocus) trigger.value?.focus();
}

onClickOutside(root, () => close(false));
</script>

<template>
  <!-- .prevent marks the Escape handled, so a layer under the menu (the
       import paste panel) doesn't close on the same press. -->
  <div
    ref="root"
    class="relative"
    @keydown.escape.capture.prevent="close(true)"
  >
    <button
      ref="trigger"
      type="button"
      class="pg-toolbar-icon-btn"
      data-testid="host-settings"
      :title="t.host.settings.label"
      :aria-label="t.host.settings.label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <Settings2 :size="16" :stroke-width="1.5" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      :id="panelId"
      role="dialog"
      :aria-label="t.host.settings.label"
      data-testid="host-settings-panel"
      class="pg-settings-panel"
    >
      <fieldset class="m-0 border-0 p-0">
        <legend class="pg-settings-label">
          {{ t.host.settings.theme }}
        </legend>
        <div class="pg-theme-options">
          <label
            v-for="option in THEMES"
            :key="option.value"
            class="pg-theme-option"
            :data-testid="`theme-option-${option.value}`"
          >
            <input
              v-model="uiTheme"
              type="radio"
              name="pg-theme"
              :value="option.value"
              class="sr-only"
            />
            <component :is="option.icon" :size="14" aria-hidden="true" />
            {{ t.theme[option.value] }}
          </label>
        </div>
      </fieldset>
      <label :for="localeId" class="pg-settings-label mt-3">
        {{ t.host.settings.language }}
      </label>
      <select
        :id="localeId"
        v-model="locale"
        data-testid="locale-select"
        class="pg-select"
      >
        <option v-for="loc in supportedLocales" :key="loc" :value="loc">
          {{ loc.toUpperCase() }}
        </option>
      </select>
    </div>
  </div>
</template>
