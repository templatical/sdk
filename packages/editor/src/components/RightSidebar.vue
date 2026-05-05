<script setup lang="ts">
import TemplateSettingsPanel from "./TemplateSettings.vue";
import Toolbar from "./Toolbar.vue";
import { useI18n } from "../composables/useI18n";
import { ACCESSIBILITY_LINT_KEY } from "../keys";
import type { Block, TemplateSettings } from "@templatical/types";
import { Accessibility, LayoutTemplate, PanelTop, Settings } from "@lucide/vue";
import { computed, defineAsyncComponent, inject, ref, watch } from "vue";

const AccessibilityPanel = defineAsyncComponent(
  () => import("./sidebar/AccessibilityPanel.vue"),
);

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

type Tab = "content" | "settings" | "accessibility";
const activeTab = ref<Tab>("content");

const lint = inject(ACCESSIBILITY_LINT_KEY, null);
const a11yEnabled = computed(() => lint !== null);
const a11yIssueCount = computed(() => lint?.issues.value.length ?? 0);

function tabClass(tab: Tab): string {
  const isActive = activeTab.value === tab;
  if (isActive) {
    return "tpl:flex-1 tpl:text-[var(--tpl-primary)]";
  }
  return "tpl:shrink-0 tpl:text-[var(--tpl-text-muted)] hover:tpl:text-[var(--tpl-text)]";
}

function tabStyle(tab: Tab): Record<string, string> {
  const isActive = activeTab.value === tab;
  if (isActive) {
    return {
      backgroundColor: "var(--tpl-bg)",
      boxShadow: "var(--tpl-shadow-md)",
    };
  }
  return { backgroundColor: "transparent" };
}

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
      class="tpl:relative tpl:flex tpl:gap-1 tpl:border-b tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-active)] tpl:p-1.5"
    >
      <button
        id="tpl-tab-content"
        role="tab"
        :aria-selected="activeTab === 'content'"
        aria-controls="tpl-tabpanel-content"
        :aria-label="t.sidebar.content"
        :title="t.sidebar.content"
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
        :class="tabClass('content')"
        :style="tabStyle('content')"
        @click="activeTab = 'content'"
      >
        <PanelTop :size="14" :stroke-width="2" />
        <span v-if="activeTab === 'content'">{{ t.sidebar.content }}</span>
      </button>
      <button
        id="tpl-tab-settings"
        role="tab"
        :aria-selected="activeTab === 'settings'"
        aria-controls="tpl-tabpanel-settings"
        :aria-label="t.sidebar.settings"
        :title="t.sidebar.settings"
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
        :class="tabClass('settings')"
        :style="tabStyle('settings')"
        @click="activeTab = 'settings'"
      >
        <Settings :size="14" :stroke-width="1.5" />
        <span v-if="activeTab === 'settings'">{{ t.sidebar.settings }}</span>
      </button>
      <button
        v-if="a11yEnabled"
        id="tpl-tab-accessibility"
        role="tab"
        :aria-selected="activeTab === 'accessibility'"
        aria-controls="tpl-tabpanel-accessibility"
        :aria-label="t.accessibility.panelTabLabel"
        :title="t.accessibility.panelTabLabel"
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
        :class="tabClass('accessibility')"
        :style="tabStyle('accessibility')"
        @click="activeTab = 'accessibility'"
      >
        <Accessibility :size="14" :stroke-width="1.5" />
        <span v-if="activeTab === 'accessibility'">
          {{ t.accessibility.panelTabLabel }}
        </span>
        <span
          v-if="a11yIssueCount > 0"
          class="tpl:ml-1 tpl:rounded-full tpl:bg-[var(--tpl-bg-hover)] tpl:px-1.5 tpl:text-[10px]"
        >
          {{ a11yIssueCount }}
        </span>
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

    <div
      v-if="activeTab === 'accessibility' && a11yEnabled"
      id="tpl-tabpanel-accessibility"
      role="tabpanel"
      aria-labelledby="tpl-tab-accessibility"
      class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-y-auto"
    >
      <AccessibilityPanel />
    </div>
  </aside>
</template>
