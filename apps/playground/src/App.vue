<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from "vue";
import {
  useClipboard,
  useFileDialog,
  useLocalStorage,
  useScrollLock,
  useTimeoutFn,
  onClickOutside,
} from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { init, unmount } from "@templatical/vue";
import type { TemplaticalEditor } from "@templatical/vue";
import type {
  TemplateContent,
  MergeTag,
  CustomBlockDefinition,
} from "@templatical/types";
import { createDefaultTemplateContent } from "@templatical/types";
import { convertBeeFreeTemplate } from "@templatical/import-beefree";
import type { BeeFreeTemplate } from "@templatical/import-beefree";
import {
  templates,
  customBlockDefinitions,
  registerDataSourcePicker,
  resolveDataSourcePicker,
} from "@/templates";
import type {
  TemplateOption,
  TemplateFeature,
  DataSourcePickerRequest,
  DataSourcePickerItem,
} from "@/templates";
import CodeEditor from "@/CodeEditor.vue";
import LogoIcon from "@/LogoIcon.vue";

type Screen = "chooser" | "editor";
const screen = ref<Screen>("chooser");
const cloudBannerDismissed = ref(false);
const showBeefreeImport = ref(false);
const beefreeJson = ref("");
const beefreeError = ref("");

// Feature showcase overlay
const showFeatureOverlay = ref(false);
const currentFeatures = ref<TemplateFeature[]>([]);
const currentTemplateName = ref("");

const dismissedTemplates = useLocalStorage<string[]>(
  "tpl-playground-features-dismissed",
  [],
);

function dismissFeatureOverlay(): void {
  showFeatureOverlay.value = false;
  if (
    currentTemplateName.value &&
    !dismissedTemplates.value.includes(currentTemplateName.value)
  ) {
    dismissedTemplates.value = [
      ...dismissedTemplates.value,
      currentTemplateName.value,
    ];
  }
}

function reopenFeatureOverlay(): void {
  if (currentTemplateName.value) {
    dismissedTemplates.value = dismissedTemplates.value.filter(
      (n) => n !== currentTemplateName.value,
    );
  }
  showFeatureOverlay.value = true;
}

// Data source picker modal
const dataSourcePickerOpen = ref(false);
const dataSourcePickerRequest = ref<DataSourcePickerRequest | null>(null);
const dataSourcePickerFetching = ref(true);
const { start: startFetchTimer, stop: stopFetchTimer } = useTimeoutFn(
  () => {
    dataSourcePickerFetching.value = false;
  },
  3000,
  { immediate: false },
);

registerDataSourcePicker((request: DataSourcePickerRequest) => {
  dataSourcePickerRequest.value = request;
  dataSourcePickerFetching.value = true;
  dataSourcePickerOpen.value = true;
  stopFetchTimer();
  startFetchTimer();
});

function selectDataSourceItem(item: DataSourcePickerItem): void {
  stopFetchTimer();
  dataSourcePickerOpen.value = false;
  resolveDataSourcePicker(item);
}

function cancelDataSourcePicker(): void {
  stopFetchTimer();
  dataSourcePickerOpen.value = false;
  resolveDataSourcePicker(null);
}

const editorContainer = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalEditor | null>(null);
const showJson = ref(false);
const jsonContent = ref("");
const exportMenuOpen = ref(false);
const exportMenuRef = ref<HTMLElement | null>(null);
const exportDropdownRef = ref<HTMLElement | null>(null);
onClickOutside(exportDropdownRef, () => {
  exportMenuOpen.value = false;
});

function focusExportItem(index: number, delta?: number): void {
  if (!exportMenuRef.value) return;
  const items =
    exportMenuRef.value.querySelectorAll<HTMLElement>("[role=menuitem]");
  if (!items.length) return;
  const active = document.activeElement;
  let target = index;
  if (delta !== undefined) {
    const current = Array.from(items).indexOf(active as HTMLElement);
    target = (current + delta + items.length) % items.length;
  }
  items[target]?.focus();
}
const showConfig = ref(false);
const configOptionsJson = ref("");
const configContentJson = ref("");
const configThemeJson = ref("");
const configError = ref("");
const configTab = ref<"options" | "content" | "theme" | "callbacks">("options");
const enableRequestMedia = ref(true);
const enableRequestMergeTag = ref(true);
const mergeTagPickerOpen = ref(false);
let mergeTagResolve: ((tag: MergeTag | null) => void) | null = null;

const mergeTagList = ref<MergeTag[]>([
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Account ID", value: "{{account_id}}" },
  { label: "Plan Name", value: "{{plan_name}}" },
  { label: "Order ID", value: "{{order_id}}" },
  { label: "Order Total", value: "{{order_total}}" },
  { label: "Shipping Method", value: "{{shipping_method}}" },
  { label: "Tracking URL", value: "{{tracking_url}}" },
  { label: "Unsubscribe URL", value: "{{unsubscribe_url}}" },
  { label: "Preferences URL", value: "{{preferences_url}}" },
  { label: "Current Date", value: "{{current_date}}" },
]);

const mergeTags = {
  syntax: "liquid" as const,
  tags: mergeTagList.value,
};

function requestMergeTag(): Promise<MergeTag | null> {
  return new Promise((resolve) => {
    mergeTagResolve = resolve;
    mergeTagPickerOpen.value = true;
  });
}

function selectMergeTag(tag: MergeTag): void {
  mergeTagPickerOpen.value = false;
  mergeTagResolve?.(tag);
  mergeTagResolve = null;
}

function cancelMergeTagPicker(): void {
  mergeTagPickerOpen.value = false;
  mergeTagResolve?.(null);
  mergeTagResolve = null;
}

const displayConditions = {
  conditions: [
    {
      label: "VIP Partners",
      before: "{% if vip_partner %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to VIP partner accounts",
    },
    {
      label: "Free Users",
      before: '{% if plan == "free" %}',
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to free plan users",
    },
    {
      label: "Enterprise",
      before: '{% if plan == "enterprise" %}',
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to enterprise accounts",
    },
    {
      label: "Beta Testers",
      before: "{% if beta_tester %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to users in the beta program",
    },
    {
      label: "Early Bird",
      before: "{% if early_bird %}",
      after: "{% endif %}",
      group: "Registration",
      description: "Show early bird pricing for early registrants",
    },
    {
      label: "Speakers",
      before: "{% if is_speaker %}",
      after: "{% endif %}",
      group: "Role",
      description: "Show only to confirmed speakers",
    },
  ],
  allowCustom: true,
};

let selectedContent: TemplateContent | null = null;
let selectedCustomBlocks: CustomBlockDefinition[] | undefined;
let pendingEditorInit = false;

function chooseTemplate(
  content: TemplateContent,
  template?: TemplateOption,
): void {
  selectedContent = content;
  selectedCustomBlocks = template?.customBlocks;
  currentSerializableConfig = buildSerializableConfig();
  pendingEditorInit = true;
  screen.value = "editor";

  // Show feature overlay if not dismissed
  if (template?.features?.length) {
    currentFeatures.value = template.features;
    currentTemplateName.value = template.name;
    if (!dismissedTemplates.value.includes(template.name)) {
      showFeatureOverlay.value = true;
    }
  } else {
    currentFeatures.value = [];
    currentTemplateName.value = "";
  }
}

function onScreenEnter(): void {
  if (pendingEditorInit) {
    pendingEditorInit = false;
    nextTick(() => initEditor());
  }
}

function importBeefreeFromJson(raw: string): void {
  beefreeError.value = "";

  try {
    const json = JSON.parse(raw) as BeeFreeTemplate;
    const { content } = convertBeeFreeTemplate(json);
    showBeefreeImport.value = false;
    beefreeJson.value = "";
    chooseTemplate(content);
  } catch (e) {
    beefreeError.value = e instanceof Error ? e.message : "Invalid JSON";
  }
}

function confirmBeefreeImport(): void {
  const raw = beefreeJson.value.trim();
  if (!raw) {
    beefreeError.value = "Paste your BeeFree JSON or upload a file.";
    return;
  }

  importBeefreeFromJson(raw);
}

const { open: openBeefreeFile, onChange: onBeefreeFileChange } = useFileDialog({
  accept: ".json",
  multiple: false,
});

onBeefreeFileChange(async (files) => {
  const file = files?.[0];
  if (!file) return;
  const text = await file.text();
  importBeefreeFromJson(text);
});

function backToChooser(): void {
  unmount();
  editor.value = null;
  screen.value = "chooser";
}

const defaultTheme = {
  bg: "oklch(99.5% 0.002 60)",
  bgElevated: "oklch(98% 0.004 60)",
  bgHover: "oklch(96% 0.006 60)",
  bgActive: "oklch(93.5% 0.008 60)",
  border: "oklch(92% 0.006 60)",
  borderLight: "oklch(86% 0.01 60)",
  text: "oklch(18% 0.01 60)",
  textMuted: "oklch(50% 0.015 60)",
  textDim: "oklch(68% 0.012 60)",
  primary: "oklch(70% 0.16 55)",
  primaryHover: "oklch(63% 0.17 55)",
  primaryLight: "oklch(95% 0.04 55)",
  secondary: "oklch(60% 0.118 184.71)",
  secondaryHover: "oklch(53.2% 0.105 186.39)",
  secondaryLight: "oklch(93.8% 0.03 186.82)",
  success: "oklch(62.8% 0.194 155.1)",
  successLight: "oklch(93.6% 0.043 163.51)",
  warning: "oklch(76.9% 0.168 70.08)",
  warningLight: "oklch(95% 0.038 73.59)",
  danger: "oklch(63.7% 0.237 25.33)",
  dangerLight: "oklch(93.6% 0.032 17.72)",
  canvasBg: "oklch(97.5% 0.003 60)",
};

let currentTheme: Record<string, string> = { ...defaultTheme };

function buildSerializableConfig() {
  return {
    content: selectedContent ?? createDefaultTemplateContent(),
    mergeTags,
    displayConditions,
    customBlocks:
      selectedCustomBlocks !== undefined
        ? selectedCustomBlocks
        : customBlockDefinitions,
  };
}

let currentSerializableConfig = buildSerializableConfig();

// --- Media picker ---
const mediaPickerOpen = ref(false);
let mediaResolve: ((url: string) => void) | null = null;

const demoImages = [
  {
    label: "Product Shot",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80",
  },
  {
    label: "Team Photo",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&q=80",
  },
  {
    label: "Abstract",
    url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=200&q=80",
  },
];

function requestMedia(callback: (url: string) => void): void {
  mediaResolve = callback;
  mediaPickerOpen.value = true;
}

function selectMedia(url: string): void {
  mediaPickerOpen.value = false;
  mediaResolve?.(url);
  mediaResolve = null;
}

function cancelMediaPicker(): void {
  mediaPickerOpen.value = false;
  mediaResolve = null;
}

const initError = ref("");

function initEditor(): void {
  if (!editorContainer.value) return;

  initError.value = "";
  try {
    editor.value = init({
      container: editorContainer.value,
      ...currentSerializableConfig,
      theme: currentTheme,
      onRequestMedia: enableRequestMedia.value ? requestMedia : undefined,
      onRequestMergeTag: enableRequestMergeTag.value
        ? requestMergeTag
        : undefined,
    });
  } catch (err) {
    console.error("[Playground] Editor init failed:", err);
    initError.value = `Failed to initialize editor: ${(err as Error).message}`;
  }
}

function openConfig(): void {
  if (editor.value) {
    currentSerializableConfig.content = editor.value.getContent();
  }
  const { content, ...options } = currentSerializableConfig;
  configOptionsJson.value = JSON.stringify(options, null, 2);
  configContentJson.value = JSON.stringify(content, null, 2);
  configThemeJson.value = JSON.stringify(currentTheme, null, 2);
  configError.value = "";
  configTab.value = "options";
  showConfig.value = true;
}

function applyConfig(): void {
  configError.value = "";
  try {
    const options = JSON.parse(configOptionsJson.value);
    const content = JSON.parse(configContentJson.value);
    const theme = JSON.parse(configThemeJson.value);
    currentSerializableConfig = { ...options, content };
    selectedContent = content;
    selectedCustomBlocks = options.customBlocks;
    currentTheme = theme;
    if (options.mergeTags?.tags) {
      mergeTagList.value = options.mergeTags.tags;
    }
    showConfig.value = false;
    initEditor();
  } catch (e) {
    configError.value = e instanceof Error ? e.message : "Invalid JSON";
  }
}

function toggleJson(): void {
  if (!editor.value) return;
  jsonContent.value = JSON.stringify(editor.value.getContent(), null, 2);
  showJson.value = true;
}

const { copy, copied } = useClipboard({ copiedDuring: 1500 });

function copyJson(): void {
  copy(jsonContent.value);
}

// --- Focus traps for modals (useFocusTrap) ---
const trapOpts = { allowOutsideClick: true, escapeDeactivates: false };

function useModalTrap(isOpen: typeof showJson) {
  const target = ref<HTMLElement | null>(null);
  const { activate, deactivate } = useFocusTrap(target, trapOpts);
  watch(isOpen, async (open) => {
    if (open) {
      await nextTick();
      activate();
    } else {
      deactivate();
    }
  });
  return target;
}

const jsonModalRef = useModalTrap(showJson);
const configModalRef = useModalTrap(showConfig);
const beefreeModalRef = useModalTrap(showBeefreeImport);
const mergeTagModalRef = useModalTrap(mergeTagPickerOpen);
const mediaModalRef = useModalTrap(mediaPickerOpen);
const dataSourceModalRef = useModalTrap(
  computed(() => dataSourcePickerOpen.value && !!dataSourcePickerRequest.value),
);
const featureModalRef = useModalTrap(showFeatureOverlay);

// --- Lock body scroll when any modal is open ---
const bodyScrollLocked = useScrollLock(document.body);
watch(
  () =>
    showJson.value ||
    showConfig.value ||
    showBeefreeImport.value ||
    mergeTagPickerOpen.value ||
    mediaPickerOpen.value ||
    (dataSourcePickerOpen.value && !!dataSourcePickerRequest.value) ||
    showFeatureOverlay.value,
  (locked) => {
    bodyScrollLocked.value = locked;
  },
);

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleExportJson(): void {
  if (!editor.value) return;
  const json = JSON.stringify(editor.value.getContent(), null, 2);
  downloadFile(json, "email-template.json", "application/json");
}

function handleExportMjml(): void {
  if (!editor.value) return;
  if (!editor.value.toMjml) return;
  const mjml = editor.value.toMjml();
  downloadFile(mjml, "email-template.mjml", "text/plain");
}

onUnmounted(() => {
  unmount();
});
</script>

<template>
  <div
    class="box-border flex flex-col h-screen font-sans bg-white text-gray-900"
  >
    <Transition name="pg-screen" mode="out-in" @enter="onScreenEnter">
      <!-- Template Chooser Screen -->
      <main
        v-if="screen === 'chooser'"
        key="chooser"
        class="flex flex-col items-center justify-center min-h-screen bg-white py-12"
      >
        <div class="flex flex-col items-center max-w-[860px] w-full px-6">
          <LogoIcon class="mb-5" />
          <h1
            class="m-0 mb-2 text-[22px] font-semibold text-gray-900 tracking-[-0.02em]"
          >
            Templatical Playground
          </h1>
          <p class="m-0 mb-9 text-[15px] text-gray-500">
            Choose a starting point for your email template
          </p>

          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] w-full"
          >
            <button
              v-for="(tpl, i) in templates"
              :key="tpl.name"
              :aria-label="`Choose ${tpl.name} template`"
              class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              :style="{ animationDelay: `${i * 40}ms` }"
              @click="chooseTemplate(tpl.create(), tpl)"
            >
              <div
                class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200"
              >
                <!-- Product launch wireframe -->
                <div
                  v-if="tpl.preview === 'product'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto my-1 h-5 w-[40%] rounded bg-primary/30"
                  ></div>
                  <div class="my-0.5 h-8 w-full rounded bg-gray-200/60"></div>
                  <div
                    class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200"
                  ></div>
                </div>
                <!-- Newsletter wireframe -->
                <div
                  v-else-if="tpl.preview === 'newsletter'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[30%] rounded-[3px] bg-gray-200/40"
                  ></div>
                  <div class="my-0.5 h-8 w-full rounded bg-gray-200/60"></div>
                  <div class="h-1.5 w-[90%] rounded-[3px] bg-gray-200"></div>
                  <div class="h-1.5 w-[70%] rounded-[3px] bg-gray-200"></div>
                  <div class="h-1.5 w-[80%] rounded-[3px] bg-gray-200"></div>
                </div>
                <!-- Welcome wireframe -->
                <div
                  v-else-if="tpl.preview === 'welcome'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[35%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[60%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[70%] shrink-0 rounded-[3px] bg-gray-200"
                    ></div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[65%] shrink-0 rounded-[3px] bg-gray-200"
                    ></div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[60%] shrink-0 rounded-[3px] bg-gray-200"
                    ></div>
                  </div>
                </div>
                <!-- Order confirmation wireframe -->
                <div
                  v-else-if="tpl.preview === 'order'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[55%] rounded-[3px] bg-gray-200/50"
                  ></div>
                  <div class="flex gap-1">
                    <div class="h-1.5 w-[40%] rounded-[3px] bg-gray-200"></div>
                    <div class="h-1.5 w-[20%] rounded-[3px] bg-gray-200"></div>
                    <div class="h-1.5 w-[25%] rounded-[3px] bg-gray-200"></div>
                  </div>
                  <div class="flex gap-1">
                    <div
                      class="h-1.5 w-[40%] rounded-[3px] bg-gray-200/50"
                    ></div>
                    <div
                      class="h-1.5 w-[20%] rounded-[3px] bg-gray-200/50"
                    ></div>
                    <div
                      class="h-1.5 w-[25%] rounded-[3px] bg-gray-200/50"
                    ></div>
                  </div>
                  <div
                    class="mx-auto my-1 h-5 w-[40%] rounded bg-emerald-600/30"
                  ></div>
                </div>
                <!-- Event invitation wireframe -->
                <div
                  v-else-if="tpl.preview === 'event'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[45%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[65%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div class="my-0.5 h-8 w-full rounded bg-gray-200/40"></div>
                  <div class="flex justify-center gap-1">
                    <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200"></div>
                    <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200"></div>
                    <div class="h-1.5 w-[28%] rounded-[3px] bg-gray-200"></div>
                  </div>
                  <div
                    class="mx-auto my-1 h-5 w-[40%] rounded bg-violet-600/30"
                  ></div>
                </div>
                <!-- Sale wireframe -->
                <div
                  v-else-if="tpl.preview === 'sale'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-amber-400/60"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200"
                  ></div>
                  <div class="mt-0.5 flex gap-1">
                    <div class="h-7 flex-1 rounded-[3px] bg-gray-200/80"></div>
                    <div class="h-7 flex-1 rounded-[3px] bg-gray-200/80"></div>
                    <div class="h-7 flex-1 rounded-[3px] bg-gray-200/80"></div>
                  </div>
                  <div
                    class="mx-auto my-1 h-5 w-[40%] rounded bg-amber-400/50"
                  ></div>
                </div>
                <!-- Password reset wireframe -->
                <div
                  v-else-if="tpl.preview === 'reset'"
                  class="flex flex-col items-center gap-1.5 w-[60%]"
                >
                  <div class="h-1.5 w-[35%] rounded-[3px] bg-gray-200"></div>
                  <div class="h-1.5 w-[50%] rounded-[3px] bg-gray-200"></div>
                  <div class="h-1.5 w-[70%] rounded-[3px] bg-gray-200/50"></div>
                  <div class="my-1.5 h-5 w-[45%] rounded bg-primary/30"></div>
                  <div class="h-1.5 w-[60%] rounded-[3px] bg-gray-200/30"></div>
                </div>
              </div>
              <span
                class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900"
                >{{ tpl.name }}</span
              >
              <span
                class="block px-[14px] pb-[14px] text-xs text-gray-500 leading-[1.4]"
                >{{ tpl.description }}</span
              >
            </button>

            <button
              aria-label="Start from scratch with empty canvas"
              class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              :style="{ animationDelay: `${templates.length * 40}ms` }"
              @click="chooseTemplate(createDefaultTemplateContent())"
            >
              <div
                class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200 text-gray-500"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span
                class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900"
                >Start from Scratch</span
              >
              <span
                class="block px-[14px] pb-[14px] text-xs text-gray-500 leading-[1.4]"
                >Empty canvas with default settings</span
              >
            </button>
          </div>

          <div class="flex items-center gap-3 mt-6 text-sm text-gray-500">
            <span>Have an existing BeeFree template?</span>
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              @click="showBeefreeImport = true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 2.5v8M5 7.5L8 4.5l3 3M3 10v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Import from BeeFree
            </button>
          </div>

          <!-- Cloud Promotion Banner -->
          <a
            href="#cloud"
            class="group pg-card-stagger mt-8 w-full flex items-center gap-5 p-5 border border-primary/20 rounded-xl bg-primary/[0.04] no-underline text-left transition-all duration-200 hover:border-primary/30 hover:-translate-y-px"
            :style="{ animationDelay: `${(templates.length + 1) * 40}ms` }"
          >
            <div
              class="shrink-0 flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-gray-900 mb-0.5">
                Unlock the full experience with Cloud
              </div>
              <div class="text-xs text-gray-500 leading-relaxed">
                Real-time collaboration, AI writing assistant, version history,
                template scoring, media library, and more.
              </div>
            </div>
            <div
              class="shrink-0 flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors group-hover:text-primary-hover"
            >
              Try Cloud Playground
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
            </div>
          </a>

          <div
            class="mt-8 flex items-center gap-2 text-[13px] [&_a]:text-gray-500 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-gray-900"
          >
            <a
              href="https://docs.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              >Docs</a
            >
            <span class="text-gray-200">&middot;</span>
            <a
              href="https://github.com/templatical/editor"
              target="_blank"
              rel="noopener noreferrer"
              >GitHub</a
            >
          </div>
        </div>
      </main>

      <!-- Editor Screen -->
      <div v-else key="editor" class="flex flex-col h-full">
        <header
          class="flex items-center justify-between h-12 px-4 border-b border-gray-200 bg-white shrink-0 z-[100]"
        >
          <div class="flex items-center gap-2">
            <button
              class="pg-toolbar-btn no-underline"
              title="Back to templates"
              @click="backToChooser"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Templates
            </button>
            <button class="pg-toolbar-btn" @click="openConfig">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.5 1.75a.75.75 0 0 1 1.5 0V4a.75.75 0 0 1-1.5 0V1.75zM6.5 12a.75.75 0 0 1 1.5 0v2.25a.75.75 0 0 1-1.5 0V12zM1.75 6.5a.75.75 0 0 0 0 1.5H4a.75.75 0 0 0 0-1.5H1.75zM12 6.5a.75.75 0 0 0 0 1.5h2.25a.75.75 0 0 0 0-1.5H12z"
                  fill="currentColor"
                />
                <circle
                  cx="7.25"
                  cy="7.25"
                  r="2.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                />
              </svg>
              Config
            </button>
            <button
              v-if="currentFeatures.length"
              class="pg-toolbar-btn"
              @click="reopenFeatureOverlay"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                />
                <path
                  d="M8 5v3.5M8 10.5v.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              Features
            </button>
          </div>

          <div class="flex items-center gap-1">
            <!-- View JSON -->
            <button class="pg-toolbar-btn" @click="toggleJson">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5.5 3L2 8l3.5 5M10.5 3L14 8l-3.5 5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              JSON
            </button>

            <!-- Export dropdown -->
            <div
              ref="exportDropdownRef"
              class="relative"
              @keydown.escape="exportMenuOpen = false"
              @keydown.arrow-down.prevent="focusExportItem(0)"
              @keydown.arrow-up.prevent="focusExportItem(1)"
            >
              <button
                class="pg-toolbar-btn"
                aria-haspopup="true"
                :aria-expanded="exportMenuOpen"
                @click="exportMenuOpen = !exportMenuOpen"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 10v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10M8 2.5v8M5 7.5L8 10.5l3-3"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Export
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <div
                v-if="exportMenuOpen"
                ref="exportMenuRef"
                role="menu"
                class="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50"
                @keydown.arrow-down.prevent="focusExportItem(0, 1)"
                @keydown.arrow-up.prevent="focusExportItem(0, -1)"
              >
                <button
                  role="menuitem"
                  tabindex="-1"
                  class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:bg-gray-50 focus-visible:text-gray-900 focus-visible:outline-none"
                  @click="
                    handleExportJson();
                    exportMenuOpen = false;
                  "
                >
                  Download JSON
                </button>
                <button
                  role="menuitem"
                  tabindex="-1"
                  class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:bg-gray-50 focus-visible:text-gray-900 focus-visible:outline-none"
                  @click="
                    handleExportMjml();
                    exportMenuOpen = false;
                  "
                >
                  Download MJML
                </button>
              </div>
            </div>

            <div class="w-px h-5 bg-gray-200 mx-1" />

            <a
              href="https://docs.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              class="pg-toolbar-btn no-underline"
              >Docs</a
            >
            <a
              href="https://github.com/templatical/editor"
              target="_blank"
              rel="noopener noreferrer"
              class="pg-toolbar-btn px-2 no-underline"
              aria-label="GitHub repository"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M8 .2A8 8 0 0 0 5.47 15.79c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 8 .2z"
                />
              </svg>
            </a>
            <a
              href="#cloud"
              class="group inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium font-sans cursor-pointer no-underline whitespace-nowrap transition-all duration-150 hover:bg-primary-hover"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Try Cloud
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="transition-transform duration-150 group-hover:translate-x-0.5"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
            </a>
          </div>
        </header>

        <main class="flex flex-1 min-h-0 relative">
          <div
            v-if="initError"
            class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center"
          >
            <p class="m-0 text-sm text-red-500">{{ initError }}</p>
            <button class="pg-toolbar-btn" @click="initEditor">Retry</button>
          </div>
          <div v-else ref="editorContainer" class="flex-1 min-w-0" />

          <!-- Floating cloud upsell banner -->
          <Transition name="pg-modal">
            <div
              v-if="!cloudBannerDismissed"
              class="absolute bottom-4 left-1/2 -translate-x-1/2 z-[99] flex items-center gap-3 py-2.5 pl-4 pr-2.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] max-w-[520px] w-[calc(100%-2rem)]"
            >
              <div class="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  class="shrink-0 flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <span class="text-[13px] text-gray-600 leading-snug"
                  >Need
                  <strong class="text-gray-900 font-semibold"
                    >collaboration, AI tools, or version history</strong
                  >? Try the Cloud version.</span
                >
              </div>
              <a
                href="#cloud"
                class="shrink-0 inline-flex items-center h-7 px-3 rounded-md bg-primary text-white text-xs font-medium no-underline whitespace-nowrap transition-colors duration-150 hover:bg-primary-hover"
                >Try Cloud</a
              >
              <button
                aria-label="Dismiss"
                class="shrink-0 size-7 flex items-center justify-center border-none bg-transparent text-gray-400 cursor-pointer rounded-md transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                @click="cloudBannerDismissed = true"
              >
                &times;
              </button>
            </div>
          </Transition>
        </main>
      </div>
    </Transition>

    <!-- JSON Viewer Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="showJson"
          class="pg-modal-backdrop"
          @click.self="showJson = false"
          @keydown.escape="showJson = false"
        >
          <div
            ref="jsonModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-modal-title"
            class="pg-modal-dialog w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0"
            >
              <span
                id="json-modal-title"
                class="text-sm font-semibold text-gray-900"
                >Template JSON</span
              >
              <div class="flex items-center gap-2">
                <button
                  class="h-[30px] px-3 border border-gray-200 rounded-md bg-white text-gray-500 text-xs font-medium font-sans cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900"
                  @click="copyJson"
                >
                  <span aria-live="polite">{{
                    copied ? "Copied!" : "Copy"
                  }}</span>
                </button>
                <button
                  aria-label="Close"
                  class="pg-modal-close"
                  @click="showJson = false"
                >
                  &times;
                </button>
              </div>
            </div>
            <div
              class="flex-1 overflow-auto [&_pre]:m-0 [&_pre]:p-5 [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:font-mono [&_pre]:text-gray-500"
            >
              <pre><code>{{ jsonContent }}</code></pre>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Config Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="showConfig"
          class="pg-modal-backdrop"
          @click.self="showConfig = false"
          @keydown.escape="showConfig = false"
        >
          <div
            ref="configModalRef"
            role="dialog"
            aria-modal="true"
            aria-label="Editor Configuration"
            class="pg-modal-dialog w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0"
            >
              <div role="tablist" class="flex items-center gap-1">
                <button
                  v-for="tab in [
                    'options',
                    'content',
                    'theme',
                    'callbacks',
                  ] as const"
                  :id="`config-tab-${tab}`"
                  :key="tab"
                  role="tab"
                  :aria-selected="configTab === tab"
                  :aria-controls="`config-panel-${tab}`"
                  class="h-8 px-3 text-[13px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                  :class="
                    configTab === tab
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  "
                  @click="configTab = tab"
                >
                  {{ tab[0].toUpperCase() + tab.slice(1) }}
                </button>
              </div>
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="showConfig = false"
              >
                &times;
              </button>
            </div>
            <div class="flex-1 overflow-auto p-5">
              <div
                v-show="configTab === 'options'"
                :inert="configTab !== 'options' || undefined"
                id="config-panel-options"
                role="tabpanel"
                aria-labelledby="config-tab-options"
              >
                <CodeEditor
                  v-model="configOptionsJson"
                  aria-label="Editor options JSON"
                />
              </div>
              <div
                v-show="configTab === 'content'"
                :inert="configTab !== 'content' || undefined"
                id="config-panel-content"
                role="tabpanel"
                aria-labelledby="config-tab-content"
              >
                <CodeEditor
                  v-model="configContentJson"
                  aria-label="Template content JSON"
                />
              </div>
              <div
                v-show="configTab === 'theme'"
                :inert="configTab !== 'theme' || undefined"
                id="config-panel-theme"
                role="tabpanel"
                aria-labelledby="config-tab-theme"
              >
                <CodeEditor
                  v-model="configThemeJson"
                  aria-label="Theme configuration JSON"
                />
              </div>
              <div
                v-show="configTab === 'callbacks'"
                :inert="configTab !== 'callbacks' || undefined"
                id="config-panel-callbacks"
                role="tabpanel"
                aria-labelledby="config-tab-callbacks"
                class="flex flex-col gap-4"
              >
                <p class="m-0 text-[13px] text-gray-500">
                  Toggle callback handlers passed to the editor. Changes apply
                  on "Apply &amp; Reload".
                </p>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="enableRequestMedia"
                    type="checkbox"
                    class="size-4 accent-primary cursor-pointer"
                  />
                  <div>
                    <span class="text-[13px] font-medium text-gray-900"
                      >onRequestMedia</span
                    >
                    <p class="m-0 mt-0.5 text-[12px] text-gray-500">
                      Opens a demo image picker when the user clicks "Browse
                      Media"
                    </p>
                  </div>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="enableRequestMergeTag"
                    type="checkbox"
                    class="size-4 accent-primary cursor-pointer"
                  />
                  <div>
                    <span class="text-[13px] font-medium text-gray-900"
                      >onRequestMergeTag</span
                    >
                    <p class="m-0 mt-0.5 text-[12px] text-gray-500">
                      Opens a merge tag picker when the user inserts a
                      placeholder
                    </p>
                  </div>
                </label>
              </div>
              <p v-if="configError" class="mt-2 mb-0 text-[13px] text-red-500">
                {{ configError }}
              </p>
            </div>
            <div
              class="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0"
            >
              <p class="m-0 text-xs text-gray-400">
                {{
                  {
                    options: "mergeTags, displayConditions, customBlocks",
                    content: "Template block structure",
                    theme: "Colors and visual overrides (OKLch)",
                    callbacks: "onRequestMedia, onRequestMergeTag",
                  }[configTab]
                }}
              </p>
              <div class="flex items-center gap-2">
                <button
                  class="h-9 px-4 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
                  @click="showConfig = false"
                >
                  Cancel
                </button>
                <button
                  class="pg-cta h-9 px-4 text-[13px] rounded-md"
                  @click="applyConfig"
                >
                  Apply & Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- BeeFree Import Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="showBeefreeImport"
          class="pg-modal-backdrop"
          @click.self="showBeefreeImport = false"
          @keydown.escape="
            showBeefreeImport = false;
            beefreeError = '';
          "
        >
          <div
            ref="beefreeModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beefree-modal-title"
            class="pg-modal-dialog w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0"
            >
              <div>
                <span
                  id="beefree-modal-title"
                  class="text-sm font-semibold text-gray-900"
                  >Import BeeFree Template</span
                >
                <p class="m-0 mt-1 text-xs text-gray-500">
                  Paste the JSON export from your BeeFree editor below.
                </p>
              </div>
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="
                  showBeefreeImport = false;
                  beefreeError = '';
                "
              >
                &times;
              </button>
            </div>
            <div class="flex-1 overflow-auto p-5">
              <button
                class="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 cursor-pointer transition-[border-color,color] duration-150 bg-transparent hover:border-primary hover:text-gray-900"
                @click="openBeefreeFile"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span class="text-sm font-medium">Choose .json file</span>
              </button>

              <div
                class="flex items-center gap-4 my-4 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200"
              >
                <span>or paste JSON</span>
              </div>

              <textarea
                v-model="beefreeJson"
                aria-label="BeeFree JSON content"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500"
                placeholder='{"page": {"body": {...}, "rows": [...]}}'
              ></textarea>
              <p v-if="beefreeError" class="mt-2 mb-0 text-[13px] text-red-500">
                {{ beefreeError }}
              </p>
            </div>
            <div
              class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0"
            >
              <button
                class="h-9 px-4 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
                @click="
                  showBeefreeImport = false;
                  beefreeError = '';
                "
              >
                Cancel
              </button>
              <button
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                @click="confirmBeefreeImport"
              >
                Import & Open
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Merge Tag Picker Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="mergeTagPickerOpen"
          class="pg-modal-backdrop"
          @click.self="cancelMergeTagPicker"
          @keydown.escape="cancelMergeTagPicker"
        >
          <div
            ref="mergeTagModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mergetag-modal-title"
            class="pg-modal-dialog w-[380px] max-w-[90vw] max-h-[480px] flex flex-col bg-white rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200"
            >
              <span
                id="mergetag-modal-title"
                class="text-sm font-semibold text-gray-900"
                >Insert Merge Tag</span
              >
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="cancelMergeTagPicker"
              >
                &times;
              </button>
            </div>
            <div class="overflow-y-auto p-2">
              <button
                v-for="tag in mergeTagList"
                :key="tag.value"
                class="group flex items-center justify-between w-full px-3 py-2.5 border-none bg-transparent rounded-lg cursor-pointer transition-[background] duration-[120ms] text-left font-sans hover:bg-gray-50"
                @click="selectMergeTag(tag)"
              >
                <span class="text-[13px] font-medium text-gray-900">{{
                  tag.label
                }}</span>
                <code
                  class="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-gray-200"
                  >{{ tag.value }}</code
                >
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Media Picker Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="mediaPickerOpen"
          class="pg-modal-backdrop"
          @click.self="cancelMediaPicker"
          @keydown.escape="cancelMediaPicker"
        >
          <div
            ref="mediaModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-modal-title"
            class="pg-modal-dialog w-[460px] max-w-[90vw] flex flex-col bg-white rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200"
            >
              <span
                id="media-modal-title"
                class="text-sm font-semibold text-gray-900"
                >Select Image</span
              >
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="cancelMediaPicker"
              >
                &times;
              </button>
            </div>
            <div class="grid grid-cols-3 gap-3 p-4">
              <button
                v-for="img in demoImages"
                :key="img.url"
                class="group flex flex-col items-center gap-2 p-0 border border-gray-200 rounded-lg bg-white cursor-pointer transition-[border-color,box-shadow] duration-150 overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle"
                @click="selectMedia(img.url)"
              >
                <img
                  :src="img.thumb"
                  :alt="img.label"
                  class="w-full h-24 object-cover"
                />
                <span class="text-[12px] font-medium text-gray-700 pb-2">{{
                  img.label
                }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Data Source Picker Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="dataSourcePickerOpen && dataSourcePickerRequest"
          class="pg-modal-backdrop"
          @click.self="cancelDataSourcePicker"
          @keydown.escape="cancelDataSourcePicker"
        >
          <div
            ref="dataSourceModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="datasource-modal-title"
            class="pg-modal-dialog w-[500px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0"
            >
              <span
                id="datasource-modal-title"
                class="text-sm font-semibold text-gray-900"
                >{{ dataSourcePickerRequest.title }}</span
              >
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="cancelDataSourcePicker"
              >
                &times;
              </button>
            </div>
            <!-- Loading state: simulated API request -->
            <div
              v-if="dataSourcePickerFetching"
              class="flex flex-col items-center justify-center gap-4 py-12 px-5"
            >
              <svg
                class="h-6 w-6 animate-spin text-primary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="2.5"
                  opacity="0.2"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </svg>
              <div class="text-center space-y-2">
                <p class="m-0 text-sm text-gray-500">
                  Fetching data from endpoint&hellip;
                </p>
                <code
                  class="block text-[11px] text-gray-400 font-mono bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-w-full break-all"
                  >{{ dataSourcePickerRequest.endpoint }}</code
                >
                <p
                  class="m-0 text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto"
                >
                  This simulates retrieving data from your endpoint. In
                  production, the SDK calls this URL and displays the response
                  for the user to pick from.
                </p>
              </div>
            </div>

            <!-- Items revealed after loading -->
            <div v-else class="flex-1 overflow-auto p-3 space-y-2">
              <p
                class="m-0 px-2 pb-1 text-[11px] text-gray-400 uppercase tracking-[0.5px] font-medium"
              >
                Response received — select an item
              </p>
              <button
                v-for="item in dataSourcePickerRequest.items"
                :key="item.id"
                class="group flex w-full items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white cursor-pointer transition-all duration-150 text-left font-sans hover:border-primary hover:shadow-primary-ring-subtle"
                @click="selectDataSourceItem(item)"
              >
                <img
                  v-if="item.thumbnail"
                  :src="item.thumbnail"
                  :alt="item.label"
                  class="shrink-0 size-12 rounded-md object-cover border border-gray-100"
                />
                <div class="min-w-0 flex-1">
                  <div
                    class="text-[13px] font-semibold text-gray-900 group-hover:text-primary transition-colors duration-150"
                  >
                    {{ item.label }}
                  </div>
                  <p class="m-0 mt-0.5 text-xs text-gray-500 truncate">
                    {{ item.description }}
                  </p>
                </div>
                <svg
                  class="shrink-0 text-gray-300 group-hover:text-primary transition-colors duration-150"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Feature Showcase Overlay -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="showFeatureOverlay"
          class="pg-modal-backdrop"
          @click.self="dismissFeatureOverlay"
          @keydown.escape="dismissFeatureOverlay"
        >
          <div
            ref="featureModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="features-modal-title"
            class="pg-modal-dialog w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0"
            >
              <div>
                <span
                  id="features-modal-title"
                  class="text-sm font-semibold text-gray-900"
                  >Features in this template</span
                >
                <p class="m-0 mt-1 text-xs text-gray-500">
                  {{ currentTemplateName }} showcases these SDK capabilities
                </p>
              </div>
              <button
                aria-label="Close"
                class="pg-modal-close"
                @click="dismissFeatureOverlay"
              >
                &times;
              </button>
            </div>
            <div class="flex-1 overflow-auto p-5 space-y-4">
              <div
                v-for="(feature, i) in currentFeatures"
                :key="i"
                class="flex gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div
                  class="shrink-0 flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary mt-0.5"
                >
                  <svg
                    v-if="feature.icon === 'merge-tag'"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 3C3.67 3 3 3.67 3 4.5v2c0 .55-.45 1-1 1v1c.55 0 1 .45 1 1v2c0 .83.67 1.5 1.5 1.5M11.5 3c.83 0 1.5.67 1.5 1.5v2c0 .55.45 1 1 1v1c-.55 0-1 .45-1 1v2c0 .83-.67 1.5-1.5 1.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <svg
                    v-else-if="feature.icon === 'display-condition'"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M8 5v3l2 1"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <svg
                    v-else-if="feature.icon === 'data-source'"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13 4c0 1.1-2.24 2-5 2S3 5.1 3 4m10 0c0-1.1-2.24-2-5-2S3 2.9 3 4m10 0v8c0 1.1-2.24 2-5 2s-5-.9-5-2V4m10 4c0 1.1-2.24 2-5 2s-5-.9-5-2"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <svg
                    v-else-if="feature.icon === 'custom-block'"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <rect
                      x="9"
                      y="2"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <rect
                      x="2"
                      y="9"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M11.5 9.5v5M9 11.75h5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <svg
                    v-else-if="feature.icon === 'responsive'"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="1"
                      y="3"
                      width="9"
                      height="7"
                      rx="1"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <rect
                      x="11"
                      y="5"
                      width="4"
                      height="7"
                      rx="1"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <line
                      x1="1"
                      y1="13"
                      x2="10"
                      y2="13"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <svg
                    v-else
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13 2L3 14h9l-1 8"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-[13px] font-semibold text-gray-900">
                    {{ feature.label }}
                  </div>
                  <p
                    v-for="(para, pi) in feature.description.split('\n')"
                    :key="pi"
                    class="text-xs text-gray-500 leading-relaxed"
                    :class="pi === 0 ? 'm-0 mt-1.5' : 'm-0 mt-2'"
                  >
                    {{ para }}
                  </p>
                </div>
              </div>
            </div>
            <div
              class="flex items-center justify-end px-5 py-4 border-t border-gray-200 shrink-0"
            >
              <button
                class="pg-cta h-9 px-5 text-[13px] rounded-md"
                @click="dismissFeatureOverlay"
              >
                Got it, start editing
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
