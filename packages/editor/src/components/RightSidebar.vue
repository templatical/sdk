<script setup lang="ts">
import TemplateSettingsPanel from "./TemplateSettings.vue";
import Toolbar from "./Toolbar.vue";
import { useI18n } from "../composables/useI18n";
import type { Block, TemplateSettings } from "@templatical/types";
import { LayoutTemplate, PanelTop, Settings } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  selectedBlock: Block | null;
  settings: TemplateSettings;
  shiftedLeft?: boolean;
}>();

const emit = defineEmits<{
  (e: "update-block", updates: Partial<Block>): void;
  (e: "delete-block"): void;
  (e: "duplicate-block"): void;
  (e: "update-settings", settings: Partial<TemplateSettings>): void;
}>();

const { t } = useI18n();

type Tab = "content" | "settings";
const activeTab = ref<Tab>("content");

const pillOffset = computed(() =>
  activeTab.value === "content" ? "tpl:translate-x-0" : "tpl:translate-x-full",
);

watch(
  () => props.selectedBlock,
  (newBlock) => {
    if (newBlock) {
      activeTab.value = "content";
    }
  },
);
</script>

<template>
  <aside
    :aria-label="t.landmarks.rightSidebar"
    class="tpl-right-sidebar tpl:absolute tpl:top-14 tpl:bottom-0 tpl:z-40 tpl:flex tpl:w-[320px] tpl:flex-col tpl:bg-[var(--tpl-bg-elevated)] tpl:transition-all tpl:duration-200 tpl:border-l tpl:border-[var(--tpl-border)]"
    :class="shiftedLeft ? 'tpl:right-[360px]' : 'tpl:right-0'"
  >
    <div
      role="tablist"
      class="tpl:relative tpl:flex tpl:border-b tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)]"
    >
      <div
        class="tpl:absolute tpl:bottom-0 tpl:left-0 tpl:h-full tpl:w-1/2 tpl:p-1.5 tpl:transition-transform tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
        :class="pillOffset"
      >
        <div
          class="tpl:h-full tpl:w-full tpl:rounded-[var(--tpl-radius-sm)] tpl:bg-[var(--tpl-bg)] tpl:shadow-[var(--tpl-shadow)]"
        ></div>
      </div>
      <button
        id="tpl-tab-content"
        role="tab"
        :aria-selected="activeTab === 'content'"
        aria-controls="tpl-tabpanel-content"
        class="tpl:relative tpl:z-10 tpl:flex tpl:flex-1 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:px-4 tpl:py-3 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-[120ms]"
        :class="
          activeTab === 'content'
            ? 'tpl:text-[var(--tpl-primary)]'
            : 'tpl:text-[var(--tpl-text-muted)] hover:tpl:text-[var(--tpl-text)]'
        "
        @click="activeTab = 'content'"
      >
        <PanelTop :size="14" :stroke-width="2" />
        {{ t.sidebar.content }}
      </button>
      <button
        id="tpl-tab-settings"
        role="tab"
        :aria-selected="activeTab === 'settings'"
        aria-controls="tpl-tabpanel-settings"
        class="tpl:relative tpl:z-10 tpl:flex tpl:flex-1 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:px-4 tpl:py-3 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-[120ms]"
        :class="
          activeTab === 'settings'
            ? 'tpl:text-[var(--tpl-primary)]'
            : 'tpl:text-[var(--tpl-text-muted)] hover:tpl:text-[var(--tpl-text)]'
        "
        @click="activeTab = 'settings'"
      >
        <Settings :size="14" :stroke-width="1.5" />
        {{ t.sidebar.settings }}
      </button>
    </div>

    <div
      v-if="activeTab === 'content'"
      id="tpl-tabpanel-content"
      role="tabpanel"
      aria-labelledby="tpl-tab-content"
      class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-y-auto"
    >
      <Toolbar
        v-if="selectedBlock"
        :block="selectedBlock"
        @update="emit('update-block', $event)"
        @delete="emit('delete-block')"
        @duplicate="emit('duplicate-block')"
      />
      <div
        v-else
        class="tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:px-6 tpl:py-10 tpl:text-center tpl:text-[var(--tpl-text-muted)]"
      >
        <div class="tpl:mb-4 tpl:text-[var(--tpl-text-dim)]">
          <LayoutTemplate :size="40" :stroke-width="1.5" />
        </div>
        <h3
          class="tpl:m-0 tpl:mb-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ t.sidebar.noSelection }}
        </h3>
        <p class="tpl:m-0 tpl:text-sm tpl:leading-normal">
          {{ t.sidebar.noSelectionHint }}
        </p>
      </div>
    </div>

    <div
      v-if="activeTab === 'settings'"
      id="tpl-tabpanel-settings"
      role="tabpanel"
      aria-labelledby="tpl-tab-settings"
      class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-y-auto"
    >
      <TemplateSettingsPanel
        :settings="settings"
        @update="emit('update-settings', $event)"
      />
    </div>
  </aside>
</template>
