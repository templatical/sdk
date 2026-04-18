<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  inject,
  provide,
  onMounted,
  onUnmounted,
  nextTick,
  defineAsyncComponent,
} from "vue";
import {
  useClipboard,
  useFileDialog,
  useIntervalFn,
  useLocalStorage,
  usePreferredReducedMotion,
  useScrollLock,
  useTimeoutFn,
  onClickOutside,
} from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { init, unmount } from "@templatical/editor";
import type { TemplaticalEditor } from "@templatical/editor";
import type {
  TemplateContent,
  MergeTag,
  CustomBlockDefinition,
  BlockDefaults,
  TemplateDefaults,
} from "@templatical/types";
import {
  createDefaultTemplateContent,
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
} from "@templatical/types";
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
const CodeEditor = defineAsyncComponent(() => import("@/CodeEditor.vue"));
import LogoIcon from "@/LogoIcon.vue";
import {
  usePlaygroundI18n,
  usePlaygroundTheme,
  format,
  supportedLocales,
} from "@/i18n";
const { locale, t } = usePlaygroundI18n();
const { theme: uiTheme, isDark } = usePlaygroundTheme();
provide("isDark", isDark);

function cycleTheme(): void {
  const cycle = { auto: "light", light: "dark", dark: "auto" } as const;
  uiTheme.value = cycle[uiTheme.value];
}

function tplName(tpl: TemplateOption): string {
  const entry =
    t.value.templates[tpl.preview as keyof typeof t.value.templates];
  return entry?.name ?? tpl.name;
}

function tplDesc(tpl: TemplateOption): string {
  const entry =
    t.value.templates[tpl.preview as keyof typeof t.value.templates];
  return entry?.description ?? tpl.description;
}

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
  // Start onboarding after feature overlay closes
  if (!onboardingDismissed.value) {
    const id = setTimeout(() => {
      pendingOnboardingTimers.delete(id);
      startOnboarding();
    }, 1000);
    pendingOnboardingTimers.add(id);
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

const configTabs = [
  "options",
  "content",
  "theme",
  "defaults",
  "callbacks",
] as const;

function focusConfigTab(delta: number): void {
  const idx = configTabs.indexOf(configTab.value);
  const next = (idx + delta + configTabs.length) % configTabs.length;
  configTab.value = configTabs[next];
  nextTick(() => {
    document.getElementById(`config-tab-${configTabs[next]}`)?.focus();
  });
}
const showConfig = ref(false);
const configOptionsJson = ref("");
const configContentJson = ref("");
const configThemeJson = ref("");
const configDarkThemeJson = ref("");
const configThemeMode = ref<"light" | "dark">("light");
const configError = ref("");
const configTab = ref<(typeof configTabs)[number]>("options");
const enableRequestMedia = ref(true);
const enableRequestMergeTag = ref(true);

// --- Block & Template Defaults ---

interface DefaultsPreset {
  key: string;
  blockDefaults: BlockDefaults;
  templateDefaults: TemplateDefaults;
}

const defaultsPresets: DefaultsPreset[] = [
  {
    key: "templatical",
    blockDefaults: DEFAULT_BLOCK_DEFAULTS,
    templateDefaults: DEFAULT_TEMPLATE_DEFAULTS,
  },
  {
    key: "corporate",
    blockDefaults: {
      text: { fontSize: 15, color: "#1a1a2e" },
      button: {
        backgroundColor: "#0f3460",
        textColor: "#ffffff",
        borderRadius: 2,
        fontSize: 14,
        buttonPadding: { top: 14, right: 28, bottom: 14, left: 28 },
      },
      divider: { color: "#e0e0e0", thickness: 1 },
      spacer: { height: 24 },
      image: { align: "center" },
    },
    templateDefaults: {
      width: 640,
      backgroundColor: "#f8f9fa",
      fontFamily: "Georgia",
    },
  },
  {
    key: "playful",
    blockDefaults: {
      text: { fontSize: 16, color: "#2d3436" },
      button: {
        backgroundColor: "#e17055",
        textColor: "#ffffff",
        borderRadius: 24,
        fontSize: 15,
        buttonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
      },
      divider: { color: "#fab1a0", thickness: 2, lineStyle: "dashed" },
      spacer: { height: 28 },
      social: { iconSize: "large", spacing: 16 },
    },
    templateDefaults: {
      width: 600,
      backgroundColor: "#ffeaa7",
      fontFamily: "Trebuchet MS",
    },
  },
  {
    key: "minimal",
    blockDefaults: {
      text: { fontSize: 14, color: "#111111" },
      button: {
        backgroundColor: "#111111",
        textColor: "#ffffff",
        borderRadius: 0,
        fontSize: 13,
        buttonPadding: { top: 12, right: 20, bottom: 12, left: 20 },
      },
      divider: { color: "#111111", thickness: 1 },
      spacer: { height: 16 },
    },
    templateDefaults: {
      width: 560,
      backgroundColor: "#ffffff",
      fontFamily: "Helvetica",
    },
  },
];

const selectedPresetKey = ref("templatical");
const configDefaultsJson = ref("");

function buildDefaultsJson(preset: DefaultsPreset): string {
  return JSON.stringify(
    {
      blockDefaults: preset.blockDefaults,
      templateDefaults: preset.templateDefaults,
    },
    null,
    2,
  );
}

watch(selectedPresetKey, (key) => {
  const preset = defaultsPresets.find((p) => p.key === key);
  if (preset) {
    configDefaultsJson.value = buildDefaultsJson(preset);
  }
});

let currentBlockDefaults: BlockDefaults | undefined;
let currentTemplateDefaults: TemplateDefaults | undefined;
const mergeTagPickerOpen = ref(false);
let mergeTagResolve: ((tag: MergeTag | null) => void) | null = null;

const mergeTagList = computed<MergeTag[]>(() => [
  { label: t.value.mergeTags.firstName, value: "{{first_name}}" },
  { label: t.value.mergeTags.lastName, value: "{{last_name}}" },
  { label: t.value.mergeTags.email, value: "{{email}}" },
  { label: t.value.mergeTags.company, value: "{{company}}" },
  { label: t.value.mergeTags.accountId, value: "{{account_id}}" },
  { label: t.value.mergeTags.planName, value: "{{plan_name}}" },
  { label: t.value.mergeTags.orderId, value: "{{order_id}}" },
  { label: t.value.mergeTags.orderTotal, value: "{{order_total}}" },
  { label: t.value.mergeTags.shippingMethod, value: "{{shipping_method}}" },
  {
    label: t.value.mergeTags.estimatedDelivery,
    value: "{{estimated_delivery}}",
  },
  { label: t.value.mergeTags.trackingUrl, value: "{{tracking_url}}" },
  { label: t.value.mergeTags.unsubscribeUrl, value: "{{unsubscribe_url}}" },
  { label: t.value.mergeTags.preferencesUrl, value: "{{preferences_url}}" },
  { label: t.value.mergeTags.currentDate, value: "{{current_date}}" },
]);

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
    nextTick(() => {
      initEditor();
      // Start onboarding after editor has mounted (slight delay to let user orient)
      if (!onboardingDismissed.value && !showFeatureOverlay.value) {
        const id = setTimeout(() => {
          pendingOnboardingTimers.delete(id);
          startOnboarding();
        }, 1000);
        pendingOnboardingTimers.add(id);
      }
    });
  }
}

async function importBeefreeFromJson(raw: string): Promise<void> {
  beefreeError.value = "";

  try {
    const json = JSON.parse(raw);
    const { convertBeeFreeTemplate } =
      await import("@templatical/import-beefree");
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
    beefreeError.value = t.value.beefreeModal.emptyError;
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

const defaultDarkTheme = {
  bg: "oklch(16% 0.005 60)",
  bgElevated: "oklch(21% 0.006 60)",
  bgHover: "oklch(26% 0.007 60)",
  bgActive: "oklch(30% 0.008 60)",
  border: "oklch(30% 0.006 60)",
  borderLight: "oklch(38% 0.008 60)",
  text: "oklch(93% 0.005 60)",
  textMuted: "oklch(65% 0.01 60)",
  textDim: "oklch(50% 0.008 60)",
  primary: "oklch(73% 0.15 55)",
  primaryHover: "oklch(78% 0.14 55)",
  primaryLight: "oklch(28% 0.05 55)",
  secondary: "oklch(63% 0.11 184.71)",
  secondaryHover: "oklch(68% 0.1 186.39)",
  secondaryLight: "oklch(25% 0.03 186.82)",
  success: "oklch(65% 0.18 155.1)",
  successLight: "oklch(25% 0.04 163.51)",
  warning: "oklch(78% 0.16 70.08)",
  warningLight: "oklch(28% 0.04 73.59)",
  danger: "oklch(65% 0.22 25.33)",
  dangerLight: "oklch(25% 0.04 17.72)",
  canvasBg: "oklch(10% 0.003 60)",
};

let currentTheme: Record<string, string> = { ...defaultTheme };
let currentDarkTheme: Record<string, string> = { ...defaultDarkTheme };

function buildSerializableConfig() {
  return {
    content: selectedContent ?? createDefaultTemplateContent(),
    mergeTags: { syntax: "liquid" as const, tags: mergeTagList.value },
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
let mediaResolve:
  | ((result: { url: string; alt?: string } | null) => void)
  | null = null;

const demoImages = computed(() => [
  {
    label: t.value.demoImages.productShot,
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80",
  },
  {
    label: t.value.demoImages.teamPhoto,
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&q=80",
  },
  {
    label: t.value.demoImages.abstract,
    url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&q=80",
    thumb:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=200&q=80",
  },
]);

function requestMedia(): Promise<{ url: string; alt?: string } | null> {
  mediaPickerOpen.value = true;
  return new Promise((resolve) => {
    mediaResolve = resolve;
  });
}

function selectMedia(url: string, alt?: string): void {
  mediaPickerOpen.value = false;
  mediaResolve?.({ url, alt });
  mediaResolve = null;
}

function cancelMediaPicker(): void {
  mediaPickerOpen.value = false;
  mediaResolve?.(null);
  mediaResolve = null;
}

const initError = ref("");

async function initEditor(): Promise<void> {
  if (!editorContainer.value) return;

  initError.value = "";
  try {
    editor.value = await init({
      container: editorContainer.value,
      ...currentSerializableConfig,
      mergeTags: {
        ...currentSerializableConfig.mergeTags,
        onRequest: enableRequestMergeTag.value ? requestMergeTag : undefined,
      },
      blockDefaults: currentBlockDefaults,
      templateDefaults: currentTemplateDefaults,
      theme: { ...currentTheme, dark: currentDarkTheme },
      uiTheme: uiTheme.value,
      locale: locale.value,
      onRequestMedia: enableRequestMedia.value ? requestMedia : undefined,
    });
  } catch (err) {
    console.error("[Playground] Editor init failed:", err);
    initError.value = format(t.value.error.initFailed, {
      message: (err as Error).message,
    });
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
  configDarkThemeJson.value = JSON.stringify(currentDarkTheme, null, 2);
  const currentPreset =
    defaultsPresets.find((p) => p.key === selectedPresetKey.value) ??
    defaultsPresets[0];
  configDefaultsJson.value = buildDefaultsJson(currentPreset);
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
    const darkTheme = JSON.parse(configDarkThemeJson.value);
    const defaults = JSON.parse(configDefaultsJson.value);
    currentSerializableConfig = { ...options, content };
    selectedContent = content;
    selectedCustomBlocks = options.customBlocks;
    currentTheme = theme;
    currentDarkTheme = darkTheme;
    currentBlockDefaults = defaults.blockDefaults;
    currentTemplateDefaults = defaults.templateDefaults;
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

// --- Share ---
const shareId = inject<string | null>("shareId", null);
const shareModalOpen = ref(false);
const shareUrl = ref("");
const shareLoading = ref(false);
const shareError = ref("");
const shareLoadPending = ref(!!shareId);
const shareLoadError = ref(false);

const {
  copy: copyShareUrl,
  copied: shareCopied,
  isSupported: clipboardSupported,
} = useClipboard({ copiedDuring: 1500 });

async function handleShare(): Promise<void> {
  if (!editor.value) return;
  shareLoading.value = true;
  shareError.value = "";
  shareUrl.value = "";
  shareModalOpen.value = true;
  try {
    const content = editor.value.getContent();
    const res = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    shareUrl.value = data.url;
  } catch (e) {
    shareError.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    shareLoading.value = false;
  }
}

onMounted(async () => {
  if (!shareId) return;
  try {
    const res = await fetch(`/api/shares/${shareId}`);
    if (!res.ok) throw new Error(res.status === 404 ? "not-found" : "error");
    const data = await res.json();
    chooseTemplate(data.content);
  } catch {
    shareLoadError.value = true;
  } finally {
    shareLoadPending.value = false;
  }
});

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
const onboardingActive = ref(false);
const pendingOnboardingTimers = new Set<ReturnType<typeof setTimeout>>();

const featureModalRef = useModalTrap(showFeatureOverlay);
const shareModalRef = useModalTrap(shareModalOpen);
const onboardingTooltipRef = useModalTrap(onboardingActive);

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
    showFeatureOverlay.value ||
    shareModalOpen.value ||
    onboardingActive.value,
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

watch(locale, () => {
  if (screen.value === "editor" && editor.value) {
    initEditor();
  }
});

watch(uiTheme, (theme) => {
  if (editor.value) {
    editor.value.setTheme(theme);
  }
});

// --- Onboarding tour ---
type OnboardingStep =
  | "canvas"
  | "sidebar"
  | "rightSidebar"
  | "config"
  | "json"
  | "export"
  | "share"
  | "cloud";

const onboardingSteps: OnboardingStep[] = [
  "canvas",
  "sidebar",
  "rightSidebar",
  "config",
  "json",
  "export",
  "share",
  "cloud",
];

const onboardingDismissed = useLocalStorage(
  "tpl-playground-onboarding-dismissed",
  false,
);
const onboardingStepIndex = ref(0);
const onboardingRect = ref<DOMRect | null>(null);
const typedText = ref("");
const prefersReducedMotion = usePreferredReducedMotion();
let typewriterCharIndex = 0;
const { pause: stopTypewriter, resume: resumeTypewriter } = useIntervalFn(
  () => {
    const fullText = onboardingStepData.value.text;
    if (typewriterCharIndex < fullText.length) {
      typedText.value = fullText.slice(0, typewriterCharIndex + 1);
      typewriterCharIndex++;
    } else {
      stopTypewriter();
    }
  },
  25,
  { immediate: false },
);

const currentOnboardingStep = computed(
  () => onboardingSteps[onboardingStepIndex.value],
);

const onboardingI18nKey: Record<OnboardingStep, string> = {
  canvas: "canvas",
  sidebar: "sidebar",
  rightSidebar: "rightSidebar",
  config: "config",
  json: "json",
  export: "exportBtn",
  share: "share",
  cloud: "cloud",
};

const onboardingStepData = computed(() => {
  const key = onboardingI18nKey[currentOnboardingStep.value];
  const data = t.value.onboarding[key as keyof typeof t.value.onboarding] as {
    title: string;
    text: string;
  };
  return { title: data.title, text: data.text };
});

const onboardingSelector: Partial<Record<OnboardingStep, string>> = {
  canvas: ".tpl-body",
  sidebar: ".tpl-sidebar-rail",
  rightSidebar: ".tpl-right-sidebar",
};

function updateOnboardingRect(): void {
  const step = currentOnboardingStep.value;
  const selector = onboardingSelector[step] ?? `[data-onboarding="${step}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (el) {
    // Scroll toolbar items into view on mobile before measuring
    if (!onboardingSelector[step]) {
      el.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
    }
    onboardingRect.value = el.getBoundingClientRect();
  }
}

function startTypewriter(): void {
  stopTypewriter();
  const fullText = onboardingStepData.value.text;
  typedText.value = "";
  if (prefersReducedMotion.value === "reduce") {
    typedText.value = fullText;
    return;
  }
  typewriterCharIndex = 0;
  resumeTypewriter();
}

function startOnboarding(): void {
  if (onboardingDismissed.value) return;
  onboardingStepIndex.value = 0;
  onboardingActive.value = true;
  nextTick(() => {
    updateOnboardingRect();
    startTypewriter();
  });
}

function nextOnboardingStep(): void {
  if (onboardingStepIndex.value < onboardingSteps.length - 1) {
    onboardingStepIndex.value++;
    nextTick(() => {
      updateOnboardingRect();
      startTypewriter();
    });
  } else {
    dismissOnboarding();
  }
}

function dismissOnboarding(): void {
  stopTypewriter();
  onboardingActive.value = false;
  onboardingDismissed.value = true;
}

function restartOnboarding(): void {
  onboardingDismissed.value = false;
  startOnboarding();
}

const onboardingTooltipStyle = computed(() => {
  const rect = onboardingRect.value;
  if (!rect) return {};
  const step = currentOnboardingStep.value;
  const pad = 12;

  // Canvas: center the tooltip over the canvas area
  if (step === "canvas") {
    return {
      top: `${rect.top + rect.height / 3}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translate(-50%, -50%)",
    };
  }

  // Sidebar: position tooltip to the right of the sidebar
  if (step === "sidebar") {
    return {
      top: `${rect.top + rect.height / 3}px`,
      left: `${rect.right + pad}px`,
    };
  }

  // Right sidebar: position tooltip to the left of the sidebar
  if (step === "rightSidebar") {
    return {
      top: `${rect.top + rect.height / 3}px`,
      left: `${rect.left - 300 - pad}px`,
    };
  }

  // Toolbar buttons: position below
  return {
    top: `${rect.bottom + pad}px`,
    left: `${Math.min(rect.left, window.innerWidth - 320)}px`,
  };
});

const onboardingSpotlightStyle = computed(() => {
  const rect = onboardingRect.value;
  if (!rect) return {};
  const step = currentOnboardingStep.value;
  const pad = 6;
  const isLargePanel =
    step === "canvas" || step === "sidebar" || step === "rightSidebar";
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const x = rect.left - pad;
  const y = rect.top - pad;
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${x}px, ${y}px)`,
    borderRadius: isLargePanel ? "14px" : "8px",
  };
});

onUnmounted(() => {
  stopTypewriter();
  pendingOnboardingTimers.forEach(clearTimeout);
  pendingOnboardingTimers.clear();
  unmount();
});
</script>

<template>
  <div
    class="box-border flex flex-col h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <Transition name="pg-screen" mode="out-in" @enter="onScreenEnter">
      <!-- Template Chooser Screen -->
      <main
        v-if="screen === 'chooser'"
        key="chooser"
        data-testid="chooser-screen"
        class="relative flex flex-col items-center justify-center min-h-screen bg-white py-12 dark:bg-gray-900"
      >
        <div class="absolute top-4 right-4 flex items-center gap-1.5">
          <button
            class="pg-theme-btn"
            :title="t.theme[uiTheme]"
            :aria-label="t.a11y.selectTheme"
            @click="cycleTheme"
          >
            <!-- Auto: monitor icon -->
            <svg
              v-if="uiTheme === 'auto'"
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
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <!-- Light: sun icon -->
            <svg
              v-else-if="uiTheme === 'light'"
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
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
              />
            </svg>
            <!-- Dark: moon icon -->
            <svg
              v-else
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
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </button>
          <select
            v-model="locale"
            :aria-label="t.a11y.selectLanguage"
            class="pg-locale-select"
          >
            <option v-for="loc in supportedLocales" :key="loc" :value="loc">
              {{ loc.toUpperCase() }}
            </option>
          </select>
        </div>
        <!-- Shared template loading -->
        <div
          v-if="shareLoadPending"
          role="status"
          class="flex flex-col items-center gap-3 py-20"
        >
          <svg
            class="animate-spin h-6 w-6 text-gray-400 dark:text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span class="text-sm text-gray-500 dark:text-gray-400">{{
            t.sharedTemplate.loading
          }}</span>
        </div>

        <!-- Shared template error -->
        <div
          v-else-if="shareLoadError"
          class="flex flex-col items-center gap-4 py-20"
        >
          <LogoIcon class="mb-2" />
          <p class="text-sm text-gray-500 dark:text-gray-400 m-0">
            {{ t.sharedTemplate.notFound }}
          </p>
          <a
            href="/"
            class="h-9 px-5 inline-flex items-center bg-gray-900 text-white text-sm font-medium font-sans rounded-md no-underline transition-colors duration-150 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {{ t.sharedTemplate.goToPlayground }}
          </a>
        </div>

        <div
          v-else
          class="flex flex-col items-center max-w-[860px] w-full px-4 sm:px-6"
        >
          <LogoIcon class="mb-5" />
          <h1
            class="m-0 mb-2 text-[22px] font-semibold text-gray-900 tracking-[-0.02em] dark:text-gray-100"
          >
            {{ t.chooser.title }}
          </h1>
          <p class="m-0 mb-9 text-[15px] text-gray-500 dark:text-gray-400">
            {{ t.chooser.subtitle }}
          </p>

          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] w-full"
          >
            <button
              v-for="(tpl, i) in templates"
              :key="tpl.name"
              data-testid="template-card"
              :aria-label="format(t.a11y.chooseTemplate, { name: tpl.name })"
              class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
              :style="{ animationDelay: `${i * 40}ms` }"
              @click="chooseTemplate(tpl.create(), tpl)"
            >
              <div
                aria-hidden="true"
                class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200 dark:bg-gray-700/50 dark:border-gray-700"
              >
                <!-- Product launch wireframe -->
                <div
                  v-if="tpl.preview === 'product'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto my-1 h-5 w-[40%] rounded bg-primary/30"
                  ></div>
                  <div
                    class="my-0.5 h-8 w-full rounded bg-gray-200/60 dark:bg-gray-500/40"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                </div>
                <!-- Newsletter wireframe -->
                <div
                  v-else-if="tpl.preview === 'newsletter'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[30%] rounded-[3px] bg-gray-200/40 dark:bg-gray-500/30"
                  ></div>
                  <div
                    class="my-0.5 h-8 w-full rounded bg-gray-200/60 dark:bg-gray-500/40"
                  ></div>
                  <div
                    class="h-1.5 w-[90%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="h-1.5 w-[80%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                </div>
                <!-- Welcome wireframe -->
                <div
                  v-else-if="tpl.preview === 'welcome'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[35%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[60%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[70%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[65%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div
                      class="size-2.5 shrink-0 rounded-full bg-primary/30"
                    ></div>
                    <div
                      class="h-1.5 w-[60%] shrink-0 rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                  </div>
                </div>
                <!-- Order confirmation wireframe -->
                <div
                  v-else-if="tpl.preview === 'order'"
                  class="flex flex-col gap-1.5 w-[60%]"
                >
                  <div
                    class="mx-auto h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[55%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
                  ></div>
                  <div class="flex gap-1">
                    <div
                      class="h-1.5 w-[40%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                    <div
                      class="h-1.5 w-[20%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                    <div
                      class="h-1.5 w-[25%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                  </div>
                  <div class="flex gap-1">
                    <div
                      class="h-1.5 w-[40%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
                    ></div>
                    <div
                      class="h-1.5 w-[20%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
                    ></div>
                    <div
                      class="h-1.5 w-[25%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
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
                    class="mx-auto h-1.5 w-[45%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="mx-auto h-1.5 w-[65%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="my-0.5 h-8 w-full rounded bg-gray-200/40 dark:bg-gray-500/30"
                  ></div>
                  <div class="flex justify-center gap-1">
                    <div
                      class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                    <div
                      class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
                    <div
                      class="h-1.5 w-[28%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                    ></div>
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
                    class="mx-auto h-1.5 w-[70%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div class="mt-0.5 flex gap-1">
                    <div
                      class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
                    ></div>
                    <div
                      class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
                    ></div>
                    <div
                      class="h-7 flex-1 rounded-[3px] bg-gray-200/80 dark:bg-gray-500/50"
                    ></div>
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
                  <div
                    class="h-1.5 w-[35%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="h-1.5 w-[50%] rounded-[3px] bg-gray-200 dark:bg-gray-500"
                  ></div>
                  <div
                    class="h-1.5 w-[70%] rounded-[3px] bg-gray-200/50 dark:bg-gray-500/40"
                  ></div>
                  <div class="my-1.5 h-5 w-[45%] rounded bg-primary/30"></div>
                  <div
                    class="h-1.5 w-[60%] rounded-[3px] bg-gray-200/30 dark:bg-gray-500/20"
                  ></div>
                </div>
              </div>
              <span
                class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ tplName(tpl) }}</span
              >
              <span
                class="block px-[14px] pb-[14px] text-xs text-gray-500 dark:text-gray-400 leading-[1.4]"
                >{{ tplDesc(tpl) }}</span
              >
            </button>

            <button
              data-testid="blank-template-card"
              :aria-label="t.a11y.startFromScratch"
              class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700"
              :style="{ animationDelay: `${templates.length * 40}ms` }"
              @click="chooseTemplate(createDefaultTemplateContent())"
            >
              <div
                class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200 text-gray-500 dark:bg-gray-700/50 dark:border-gray-700 dark:text-gray-400"
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
                class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.chooser.startFromScratch }}</span
              >
              <span
                class="block px-[14px] pb-[14px] text-xs text-gray-500 dark:text-gray-400 leading-[1.4]"
                >{{ t.chooser.emptyCanvas }}</span
              >
            </button>
          </div>

          <div
            class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6 text-sm text-gray-500 dark:text-gray-400"
          >
            <span>{{ t.chooser.beefreePrompt }}</span>
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
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
              {{ t.chooser.importBeefree }}
            </button>
          </div>

          <!-- Cloud Promotion Banner -->
          <a
            href="#cloud"
            class="group pg-card-stagger mt-8 w-full flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 border border-primary/20 rounded-xl bg-primary/[0.04] no-underline text-left transition-all duration-200 hover:border-primary/30 hover:-translate-y-px"
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
              <div
                class="text-sm font-semibold text-gray-900 mb-0.5 dark:text-gray-100"
              >
                {{ t.cloudBanner.title }}
              </div>
              <div
                class="text-xs text-gray-500 leading-relaxed dark:text-gray-400"
              >
                {{ t.cloudBanner.description }}
              </div>
            </div>
            <div
              class="shrink-0 flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors group-hover:text-primary-hover"
            >
              {{ t.cloudBanner.cta }}
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
            class="mt-8 flex items-center gap-2 text-[13px] [&_a]:text-gray-500 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-gray-900 [&_a]:dark:text-gray-400 [&_a:hover]:dark:text-gray-100"
          >
            <a
              href="https://docs.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t.toolbar.docs }}</a
            >
            <span class="text-gray-200 dark:text-gray-700">&middot;</span>
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
      <div
        v-else
        key="editor"
        data-testid="editor-screen"
        class="flex flex-col h-full"
      >
        <header
          class="flex items-center justify-between h-12 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-2 overflow-x-auto"
        >
          <div class="flex items-center gap-2">
            <button
              data-testid="toolbar-back"
              class="pg-toolbar-btn no-underline"
              :title="t.a11y.backToTemplates"
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
              <span class="pg-toolbar-label">{{ t.toolbar.templates }}</span>
            </button>
            <button
              data-testid="toolbar-config"
              data-onboarding="config"
              class="pg-toolbar-btn"
              :title="t.toolbar.config"
              @click="openConfig"
            >
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
              <span class="pg-toolbar-label">{{ t.toolbar.config }}</span>
            </button>
            <button
              v-if="currentFeatures.length"
              class="pg-toolbar-btn"
              :title="t.toolbar.features"
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
              <span class="pg-toolbar-label">{{ t.toolbar.features }}</span>
            </button>
            <button
              data-testid="toolbar-tour"
              class="pg-toolbar-btn"
              :title="t.toolbar.tour"
              @click="restartOnboarding"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                />
                <path
                  d="M12 16v-4M12 8h.01"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              <span class="pg-toolbar-label">{{ t.toolbar.tour }}</span>
            </button>
          </div>

          <div class="flex items-center gap-1">
            <!-- View JSON -->
            <button
              data-testid="toolbar-json"
              data-onboarding="json"
              class="pg-toolbar-btn"
              :title="t.toolbar.json"
              @click="toggleJson"
            >
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
              <span class="pg-toolbar-label">{{ t.toolbar.json }}</span>
            </button>

            <!-- Export dropdown -->
            <div
              ref="exportDropdownRef"
              data-testid="toolbar-export"
              data-onboarding="export"
              class="relative"
              @keydown.escape="exportMenuOpen = false"
              @keydown.arrow-down.prevent="focusExportItem(0)"
              @keydown.arrow-up.prevent="focusExportItem(1)"
            >
              <button
                class="pg-toolbar-btn"
                :title="t.toolbar.export"
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
                <span class="pg-toolbar-label">{{ t.toolbar.export }}</span>
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
                class="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-float overflow-hidden z-50 dark:bg-gray-800 dark:border-gray-700"
                @keydown.arrow-down.prevent="focusExportItem(0, 1)"
                @keydown.arrow-up.prevent="focusExportItem(0, -1)"
              >
                <button
                  role="menuitem"
                  tabindex="-1"
                  class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:bg-gray-50 focus-visible:text-gray-900 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:bg-gray-700 dark:focus-visible:text-gray-100"
                  @click="
                    handleExportJson();
                    exportMenuOpen = false;
                  "
                >
                  {{ t.toolbar.downloadJson }}
                </button>
                <button
                  role="menuitem"
                  tabindex="-1"
                  class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:bg-gray-50 focus-visible:text-gray-900 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:bg-gray-700 dark:focus-visible:text-gray-100"
                  @click="
                    handleExportMjml();
                    exportMenuOpen = false;
                  "
                >
                  {{ t.toolbar.downloadMjml }}
                </button>
              </div>
            </div>

            <button
              data-testid="toolbar-share"
              data-onboarding="share"
              class="pg-toolbar-btn"
              :title="t.toolbar.share"
              @click="handleShare"
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
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span class="pg-toolbar-label">{{ t.toolbar.share }}</span>
            </button>

            <div
              class="w-px h-5 bg-gray-200 mx-1 hidden sm:block dark:bg-gray-700"
            />

            <a
              href="https://docs.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              class="pg-toolbar-btn no-underline hidden sm:inline-flex"
              >{{ t.toolbar.docs }}</a
            >
            <a
              href="https://github.com/templatical/editor"
              target="_blank"
              rel="noopener noreferrer"
              class="pg-toolbar-btn px-2 no-underline"
              :aria-label="t.a11y.githubRepo"
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
              data-onboarding="cloud"
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
              <span class="pg-toolbar-label">{{ t.toolbar.tryCloud }}</span>
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
                class="transition-transform duration-150 group-hover:translate-x-0.5 hidden sm:block"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
            </a>
            <button
              data-testid="toolbar-theme"
              class="pg-theme-btn"
              :title="t.theme[uiTheme]"
              :aria-label="t.a11y.selectTheme"
              @click="cycleTheme"
            >
              <svg
                v-if="uiTheme === 'auto'"
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
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
              <svg
                v-else-if="uiTheme === 'light'"
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
                <circle cx="12" cy="12" r="4" />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                />
              </svg>
              <svg
                v-else
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
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
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
        </header>

        <main
          class="flex flex-1 min-h-0 relative bg-gray-100 p-[15px] dark:bg-gray-800"
        >
          <div
            v-if="initError"
            class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700"
          >
            <p class="m-0 text-sm text-red-500">{{ initError }}</p>
            <button class="pg-toolbar-btn" @click="initEditor">
              {{ t.toolbar.retry }}
            </button>
          </div>
          <div
            v-else
            ref="editorContainer"
            data-testid="editor-container"
            data-onboarding="canvas"
            class="flex-1 min-w-0 isolate rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700"
          />

          <!-- Floating cloud upsell banner -->
          <Transition name="pg-modal">
            <div
              v-if="!cloudBannerDismissed"
              class="absolute bottom-4 left-1/2 -translate-x-1/2 z-[99] flex items-center gap-3 py-2.5 pl-4 pr-2.5 bg-white border border-gray-200 rounded-xl shadow-float max-w-[520px] w-[calc(100%-2rem)] dark:bg-gray-800 dark:border-gray-700"
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
                <span
                  class="text-[13px] text-gray-600 leading-snug dark:text-gray-400"
                  >{{ t.floatingBanner.before
                  }}<strong
                    class="text-gray-900 font-semibold dark:text-gray-100"
                    >{{ t.cloudBanner.floatingFeatures }}</strong
                  >{{ t.floatingBanner.after }}</span
                >
              </div>
              <a
                href="#cloud"
                class="shrink-0 inline-flex items-center h-7 px-3 rounded-md bg-primary text-white text-xs font-medium no-underline whitespace-nowrap transition-colors duration-150 hover:bg-primary-hover"
                >{{ t.cloudBanner.floatingCta }}</a
              >
              <button
                :aria-label="t.common.dismiss"
                class="shrink-0 size-7 flex items-center justify-center border-none bg-transparent text-gray-400 cursor-pointer rounded-md transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
            data-testid="json-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-modal-title"
            class="pg-modal-dialog w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <span
                id="json-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.jsonModal.title }}</span
              >
              <div class="flex items-center gap-2">
                <button
                  class="h-[30px] px-3 border border-gray-200 rounded-md bg-white text-gray-500 text-xs font-medium font-sans cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                  @click="copyJson"
                >
                  <span aria-live="polite">{{
                    copied ? t.jsonModal.copied : t.jsonModal.copy
                  }}</span>
                </button>
                <button
                  :aria-label="t.common.close"
                  class="pg-modal-close"
                  @click="showJson = false"
                >
                  &times;
                </button>
              </div>
            </div>
            <div class="flex-1 overflow-auto p-3">
              <CodeEditor
                :model-value="jsonContent"
                aria-label="Template JSON content"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Share Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="shareModalOpen"
          class="pg-modal-backdrop"
          @click.self="shareModalOpen = false"
          @keydown.escape="shareModalOpen = false"
        >
          <div
            ref="shareModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            class="pg-modal-dialog w-[440px] max-w-[90vw] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <span
                id="share-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.shareModal.title }}</span
              >
              <button
                :aria-label="t.common.close"
                class="pg-modal-close"
                @click="shareModalOpen = false"
              >
                &times;
              </button>
            </div>
            <div class="px-5 py-5">
              <!-- Loading -->
              <div
                v-if="shareLoading"
                role="status"
                class="flex flex-col items-center gap-3 py-4"
              >
                <svg
                  class="animate-spin h-5 w-5 text-gray-400 dark:text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span class="text-sm text-gray-500 dark:text-gray-400">{{
                  t.shareModal.loading
                }}</span>
              </div>

              <!-- Error -->
              <div
                v-else-if="shareError"
                class="flex flex-col items-center gap-3 py-4"
              >
                <p class="text-sm text-gray-500 dark:text-gray-400 m-0">
                  {{ t.shareModal.error }}
                </p>
                <button
                  class="h-8 px-4 bg-gray-900 text-white text-xs font-medium font-sans rounded-md border-none cursor-pointer transition-colors duration-150 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                  @click="handleShare"
                >
                  {{ t.shareModal.retry }}
                </button>
              </div>

              <!-- Success -->
              <div v-else class="flex flex-col gap-3">
                <p class="text-[13px] text-gray-500 dark:text-gray-400 m-0">
                  {{ t.shareModal.description }}
                </p>
                <div class="flex gap-2">
                  <input
                    :value="shareUrl"
                    readonly
                    :aria-label="t.shareModal.copyLink"
                    class="flex-1 h-9 px-3 text-[13px] font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <button
                    v-if="clipboardSupported"
                    class="h-9 px-4 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium font-sans cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                    @click="copyShareUrl(shareUrl)"
                  >
                    {{
                      shareCopied ? t.shareModal.copied : t.shareModal.copyLink
                    }}
                  </button>
                </div>
                <p class="text-[11px] text-gray-400 dark:text-gray-500 m-0">
                  {{ t.shareModal.expiry }}
                </p>
              </div>
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
            :aria-label="t.a11y.editorConfig"
            class="pg-modal-dialog w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <div
                role="tablist"
                class="flex items-center gap-1"
                @keydown.arrow-right.prevent="focusConfigTab(1)"
                @keydown.arrow-left.prevent="focusConfigTab(-1)"
              >
                <button
                  v-for="tab in configTabs"
                  :id="`config-tab-${tab}`"
                  :key="tab"
                  role="tab"
                  :aria-selected="configTab === tab"
                  :aria-controls="`config-panel-${tab}`"
                  :tabindex="configTab === tab ? 0 : -1"
                  class="pg-tab h-8 px-3 text-[13px]"
                  :class="
                    configTab === tab
                      ? 'pg-tab-active'
                      : 'pg-tab-inactive text-gray-500 dark:text-gray-400'
                  "
                  @click="configTab = tab"
                >
                  {{ t.configModal.tabs[tab] }}
                </button>
              </div>
              <button
                :aria-label="t.common.close"
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
                class="flex flex-col gap-3"
              >
                <select
                  v-model="configThemeMode"
                  class="pg-locale-select w-auto self-start"
                >
                  <option value="light">
                    {{ t.theme.light }}
                  </option>
                  <option value="dark">
                    {{ t.theme.dark }}
                  </option>
                </select>
                <CodeEditor
                  v-if="configThemeMode === 'light'"
                  v-model="configThemeJson"
                  aria-label="Theme configuration JSON"
                />
                <CodeEditor
                  v-else
                  v-model="configDarkThemeJson"
                  aria-label="Dark theme configuration JSON"
                />
              </div>
              <div
                v-show="configTab === 'defaults'"
                :inert="configTab !== 'defaults' || undefined"
                id="config-panel-defaults"
                role="tabpanel"
                aria-labelledby="config-tab-defaults"
                class="flex flex-col gap-3"
              >
                <div class="flex items-center gap-3">
                  <label
                    for="defaults-preset"
                    class="text-[13px] font-medium text-gray-700 shrink-0 dark:text-gray-300"
                    >{{ t.configModal.defaultsPresetLabel }}</label
                  >
                  <select
                    id="defaults-preset"
                    v-model="selectedPresetKey"
                    class="pg-locale-select text-[13px] text-gray-700 dark:text-gray-300"
                  >
                    <option
                      v-for="preset in defaultsPresets"
                      :key="preset.key"
                      :value="preset.key"
                    >
                      {{
                        t.configModal.defaultsPresets[
                          preset.key as keyof typeof t.configModal.defaultsPresets
                        ]
                      }}
                    </option>
                  </select>
                </div>
                <p class="m-0 text-[12px] text-gray-500 dark:text-gray-400">
                  {{ t.configModal.defaultsHint }}
                </p>
                <CodeEditor
                  v-model="configDefaultsJson"
                  aria-label="Block and template defaults JSON"
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
                <p class="m-0 text-[13px] text-gray-500 dark:text-gray-400">
                  {{ t.configModal.callbacksHint }}
                </p>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="enableRequestMedia"
                    type="checkbox"
                    class="size-4 accent-primary cursor-pointer"
                  />
                  <div>
                    <span
                      class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
                      >onRequestMedia</span
                    >
                    <p
                      class="m-0 mt-0.5 text-[12px] text-gray-500 dark:text-gray-400"
                    >
                      {{ t.configModal.onRequestMediaDesc }}
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
                    <span
                      class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
                      >mergeTags.onRequest</span
                    >
                    <p
                      class="m-0 mt-0.5 text-[12px] text-gray-500 dark:text-gray-400"
                    >
                      {{ t.configModal.onRequestMergeTag }}
                    </p>
                  </div>
                </label>
              </div>
              <p v-if="configError" class="mt-2 mb-0 text-[13px] text-red-500">
                {{ configError }}
              </p>
            </div>
            <div
              class="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0 dark:border-gray-700"
            >
              <p class="m-0 text-xs text-gray-400 dark:text-gray-500">
                {{ t.configModal.descriptions[configTab] }}
              </p>
              <div class="flex items-center gap-2">
                <button class="pg-cancel-btn" @click="showConfig = false">
                  {{ t.configModal.cancel }}
                </button>
                <button
                  class="pg-cta h-9 px-4 text-[13px] rounded-md"
                  @click="applyConfig"
                >
                  {{ t.configModal.apply }}
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
            class="pg-modal-dialog w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <div>
                <span
                  id="beefree-modal-title"
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >{{ t.beefreeModal.title }}</span
                >
                <p class="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t.beefreeModal.description }}
                </p>
              </div>
              <button
                :aria-label="t.common.close"
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
                class="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 cursor-pointer transition-[border-color,color] duration-150 bg-transparent hover:border-primary hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:text-gray-100"
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
                <span class="text-sm font-medium">{{
                  t.beefreeModal.chooseFile
                }}</span>
              </button>

              <div
                class="flex items-center gap-4 my-4 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200 dark:text-gray-400 before:dark:bg-gray-700 after:dark:bg-gray-700"
              >
                <span>{{ t.beefreeModal.orPaste }}</span>
              </div>

              <textarea
                v-model="beefreeJson"
                :aria-label="t.a11y.beefreeJsonContent"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"page": {"body": {...}, "rows": [...]}}'
              ></textarea>
              <p v-if="beefreeError" class="mt-2 mb-0 text-[13px] text-red-500">
                {{ beefreeError }}
              </p>
            </div>
            <div
              class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0 dark:border-gray-700"
            >
              <button
                class="pg-cancel-btn"
                @click="
                  showBeefreeImport = false;
                  beefreeError = '';
                "
              >
                {{ t.beefreeModal.cancel }}
              </button>
              <button
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                @click="confirmBeefreeImport"
              >
                {{ t.beefreeModal.import }}
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
            class="pg-modal-dialog w-[380px] max-w-[90vw] max-h-[480px] flex flex-col bg-white rounded-xl shadow-modal-sm overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
            >
              <span
                id="mergetag-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.mergeTagModal.title }}</span
              >
              <button
                :aria-label="t.common.close"
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
                class="group flex items-center justify-between w-full px-3 py-2.5 border-none bg-transparent rounded-lg cursor-pointer transition-[background] duration-[120ms] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-700"
                @click="selectMergeTag(tag)"
              >
                <span
                  class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
                  >{{ tag.label }}</span
                >
                <code
                  class="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:group-hover:bg-gray-600"
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
            class="pg-modal-dialog w-[460px] max-w-[90vw] flex flex-col bg-white rounded-xl shadow-modal-sm overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
            >
              <span
                id="media-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.mediaModal.title }}</span
              >
              <button
                :aria-label="t.common.close"
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
                class="group flex flex-col items-center gap-2 p-0 border border-gray-200 rounded-lg bg-white cursor-pointer transition-[border-color,box-shadow] duration-150 overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle dark:bg-gray-700 dark:border-gray-600"
                @click="selectMedia(img.url, img.label)"
              >
                <img
                  :src="img.thumb"
                  :alt="img.label"
                  loading="lazy"
                  class="w-full h-24 object-cover"
                />
                <span
                  class="text-[12px] font-medium text-gray-700 pb-2 dark:text-gray-300"
                  >{{ img.label }}</span
                >
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
            class="pg-modal-dialog w-[500px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <span
                id="datasource-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ dataSourcePickerRequest.title }}</span
              >
              <button
                :aria-label="t.common.close"
                class="pg-modal-close"
                @click="cancelDataSourcePicker"
              >
                &times;
              </button>
            </div>
            <!-- Loading state: simulated API request -->
            <div
              v-if="dataSourcePickerFetching"
              role="status"
              class="flex flex-col items-center justify-center gap-4 py-12 px-5"
            >
              <svg
                class="h-6 w-6 animate-spin text-primary"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
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
                <p class="m-0 text-sm text-gray-500 dark:text-gray-400">
                  {{ t.dataSourceModal.fetching }}
                </p>
                <code
                  class="block text-[11px] text-gray-400 font-mono bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-w-full break-all dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >{{ dataSourcePickerRequest.endpoint }}</code
                >
                <p
                  class="m-0 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-xs mx-auto"
                >
                  {{ t.dataSourceModal.fetchDescription }}
                </p>
              </div>
            </div>

            <!-- Items revealed after loading -->
            <div v-else class="flex-1 overflow-auto p-3 space-y-2">
              <p
                class="m-0 px-2 pb-1 text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.5px] font-medium"
              >
                {{ t.dataSourceModal.responseReceived }}
              </p>
              <button
                v-for="item in dataSourcePickerRequest.items"
                :key="item.id"
                class="group flex w-full items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white cursor-pointer transition-all duration-150 text-left font-sans hover:border-primary hover:shadow-primary-ring-subtle dark:bg-gray-700 dark:border-gray-600"
                @click="selectDataSourceItem(item)"
              >
                <img
                  v-if="item.thumbnail"
                  :src="item.thumbnail"
                  :alt="item.label"
                  class="shrink-0 size-12 rounded-md object-cover border border-gray-100 dark:border-gray-600"
                />
                <div class="min-w-0 flex-1">
                  <div
                    class="text-[13px] font-semibold text-gray-900 group-hover:text-primary transition-colors duration-150 dark:text-gray-100"
                  >
                    {{ item.label }}
                  </div>
                  <p
                    class="m-0 mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate"
                  >
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
            data-testid="feature-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="features-modal-title"
            class="pg-modal-dialog w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <div>
                <span
                  id="features-modal-title"
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >{{ t.featureModal.title }}</span
                >
                <p class="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    format(t.featureModal.subtitle, {
                      name: currentTemplateName,
                    })
                  }}
                </p>
              </div>
              <button
                :aria-label="t.common.close"
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
                class="flex gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100 dark:bg-gray-700 dark:border-gray-600"
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
                  <div
                    class="text-[13px] font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {{ feature.label }}
                  </div>
                  <p
                    v-for="(para, pi) in feature.description.split('\n')"
                    :key="pi"
                    class="text-xs text-gray-500 leading-relaxed dark:text-gray-400"
                    :class="pi === 0 ? 'm-0 mt-1.5' : 'm-0 mt-2'"
                  >
                    {{ para }}
                  </p>
                </div>
              </div>
            </div>
            <div
              class="flex items-center justify-end px-5 py-4 border-t border-gray-200 shrink-0 dark:border-gray-700"
            >
              <button
                class="pg-cta h-9 px-5 text-[13px] rounded-md"
                @click="dismissFeatureOverlay"
              >
                {{ t.featureModal.dismiss }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Onboarding Tour Overlay -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="onboardingActive"
          class="fixed inset-0 z-[10001]"
          @click.self="dismissOnboarding"
          @keydown.escape="dismissOnboarding"
        >
          <!-- Spotlight with backdrop shadow -->
          <div
            v-if="onboardingRect"
            class="pg-onboarding-spotlight absolute top-0 left-0"
            :style="onboardingSpotlightStyle"
            @click="dismissOnboarding"
          />

          <!-- Tooltip -->
          <div
            v-if="onboardingRect"
            ref="onboardingTooltipRef"
            role="dialog"
            aria-modal="true"
            :aria-label="onboardingStepData.title"
            class="pg-onboarding-tooltip fixed z-[10002] w-[300px] bg-white rounded-xl shadow-modal-sm overflow-hidden dark:bg-gray-800"
            :style="onboardingTooltipStyle"
          >
            <div class="px-4 pt-4 pb-3">
              <div
                class="text-xs font-medium text-primary mb-1 tracking-wide uppercase"
              >
                {{
                  format(t.onboarding.stepCounter, {
                    current: String(onboardingStepIndex + 1),
                    total: String(onboardingSteps.length),
                  })
                }}
              </div>
              <div
                class="text-[15px] font-semibold text-gray-900 mb-1.5 dark:text-gray-100"
              >
                {{ onboardingStepData.title }}
              </div>
              <div
                class="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed min-h-[40px]"
              >
                {{ typedText
                }}<span
                  v-if="typedText.length < onboardingStepData.text.length"
                  class="pg-onboarding-cursor"
                  >|</span
                >
              </div>
            </div>
            <div
              class="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <button
                class="text-[13px] text-gray-400 bg-transparent border-none cursor-pointer font-sans transition-colors duration-150 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                @click="dismissOnboarding"
              >
                {{ t.onboarding.skip }}
              </button>
              <button
                class="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-white text-[13px] font-medium font-sans border-none cursor-pointer transition-all duration-150 hover:bg-primary-hover"
                @click="nextOnboardingStep"
              >
                {{
                  onboardingStepIndex < onboardingSteps.length - 1
                    ? t.onboarding.next
                    : t.onboarding.done
                }}
                <svg
                  v-if="onboardingStepIndex < onboardingSteps.length - 1"
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
