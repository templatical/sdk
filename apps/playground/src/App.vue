<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  provide,
  onMounted,
  onUnmounted,
  nextTick,
  defineAsyncComponent,
} from "vue";
import {
  useClipboard,
  useFileDialog,
  useScrollLock,
  useTimeoutFn,
} from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { init, unmount } from "@templatical/editor";
import type {
  TemplaticalEditor,
  TemplateSettingsConfig,
} from "@templatical/editor";
import type {
  PreviewResolveContext,
  TemplateContent,
  MergeTag,
  LogicTagsConfig,
  CustomBlockDefinition,
  BlockDefaults,
  TemplateDefaults,
  ColorsConfig,
  CommentsProvider,
  FontsConfig,
  SavedBlocksProvider,
  TemplatesProvider,
  VersionHistoryProvider,
} from "@templatical/types";
import { createDefaultTemplateContent } from "@templatical/types";
import {
  templates as _templates,
  customBlockDefinitions,
  registerDataSourcePicker,
  resolveDataSourcePicker,
} from "@/templates";
import type {
  TemplateOption,
  DataSourcePickerRequest,
  DataSourcePickerItem,
} from "@/templates";
const CodeEditor = defineAsyncComponent(() => import("@/CodeEditor.vue"));
import Catalog from "@/host/Catalog.vue";
import SceneHost from "@/host/SceneHost.vue";
import { parsePlaygroundRoute } from "@/scenes";
import {
  PLAYGROUND_USER,
  commentsProviderFor as hostCommentsProviderFor,
  compileMjmlDemo,
  getLastMjmlWarnings,
  mediaProviderFor,
  savedBlocksProviderFor as hostSavedBlocksProviderFor,
  templatesProviderFor as hostTemplatesProviderFor,
  testEmailProvider,
  versionHistoryProviderFor as hostVersionHistoryProviderFor,
} from "@/host/providers";
import {
  resolveInitialShadowMode,
  SHADOW_STORAGE_KEY,
} from "@/host/shadowMode";
import {
  Monitor,
  Sun,
  Moon,
  LoaderCircle,
  Upload,
  Download,
  ChevronRight,
  ChevronLeft,
  Zap,
  Crosshair,
  Layers,
  Square,
} from "@lucide/vue";
import {
  usePlaygroundI18n,
  usePlaygroundTheme,
  useSdkLocale,
  format,
  supportedLocales,
  ossSdkLocales as sdkLocales,
} from "@/i18n";
const { locale, t } = usePlaygroundI18n();
const { sdkLocale } = useSdkLocale();

/**
 * A blank template in the language the editor is about to be initialized with.
 *
 * `createDefaultTemplateContent()` bare stamps `locale: "en"` from
 * `DEFAULT_TEMPLATE_DEFAULTS`, and because this content is handed to
 * `init({ content })`, the editor's own seeding of the content language is
 * bypassed — a German editor produced `<mjml lang="en">` over German copy. A
 * consumer that supplies content owns the language it declares.
 */
function _createBlankTemplate() {
  return createDefaultTemplateContent(undefined, { locale: sdkLocale.value });
}
const { theme: uiTheme, isDark } = usePlaygroundTheme();
provide("isDark", isDark);

const locPath = ref(window.location.pathname);
const locSearch = ref(window.location.search);

function syncPlaygroundLocation(): void {
  locPath.value = window.location.pathname;
  locSearch.value = window.location.search;
}

const playgroundRoute = computed(() =>
  parsePlaygroundRoute(locPath.value, locSearch.value),
);
const sceneRoute = computed(() =>
  playgroundRoute.value.kind === "scene" ? playgroundRoute.value : null,
);

function cycleTheme(): void {
  const cycle = { auto: "light", light: "dark", dark: "auto" } as const;
  uiTheme.value = cycle[uiTheme.value];
}

type Screen = "chooser" | "editor";
const screen = ref<Screen>("chooser");
type ImportSource =
  | "beefree"
  | "unlayer"
  | "html"
  | "mjml"
  | "topol"
  | "stripo"
  | "chamaileon"
  | "easyEmailPro";
const showImport = ref(false);
const importSource = ref<ImportSource>("unlayer");
const beefreeJson = ref("");
const beefreeError = ref("");
const unlayerJson = ref("");
const unlayerError = ref("");
const htmlSource = ref("");
const htmlError = ref("");
const mjmlSource = ref("");
const mjmlError = ref("");
const topolSource = ref("");
const topolError = ref("");
const stripoSource = ref("");
const stripoError = ref("");
const chamaileonSource = ref("");
const chamaileonError = ref("");
const easyEmailProSource = ref("");
const easyEmailProError = ref("");

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

/** Stand-in template name for content that came from an import or a share link. */
const SCRATCH_TEMPLATE_NAME = "Scratch";

function savedBlocksProviderFor(
  template?: TemplateOption,
): SavedBlocksProvider {
  return hostSavedBlocksProviderFor(template?.name ?? SCRATCH_TEMPLATE_NAME, {
    readonly:
      localStorage.getItem("tpl-playground-saved-blocks-readonly") === "true",
    delay: Number(
      localStorage.getItem("tpl-playground-saved-blocks-delay") ?? "0",
    ),
    seed: template?.savedBlocks,
  });
}

function templatesProviderFor(template?: TemplateOption): TemplatesProvider {
  return hostTemplatesProviderFor(template?.name ?? SCRATCH_TEMPLATE_NAME, {
    readonly:
      localStorage.getItem("tpl-playground-templates-readonly") === "true",
  });
}

function versionHistoryProviderFor(
  template?: TemplateOption,
): VersionHistoryProvider {
  return hostVersionHistoryProviderFor(
    template?.name ?? SCRATCH_TEMPLATE_NAME,
    {
      readonly:
        localStorage.getItem("tpl-playground-version-history-readonly") ===
        "true",
    },
  );
}

function commentsProviderFor(template?: TemplateOption): CommentsProvider {
  return hostCommentsProviderFor(template?.name ?? SCRATCH_TEMPLATE_NAME, {
    readonly:
      localStorage.getItem("tpl-playground-comments-readonly") === "true",
  });
}

/**
 * Demo `resolvePreview`: evaluates the Liquid logic tags the showcase templates
 * use, against a fixed fake recipient record, and substitutes value tags.
 *
 * Deliberately synchronous work behind an artificial delay, so the skeleton and
 * the debounce are both observable in the playground without a backend. A real
 * implementation would POST the template to your own service.
 */
const FAKE_RESOLVE_LATENCY_MS = 400;

/** Per-recipient fake data, so switching recipient visibly changes the preview. */
/**
 * Per-recipient fake data. Deliberately **different from the `sample` values**
 * on the same tags (`{{first_name}}`'s sample is "Ada"): if the two matched, a
 * test asserting "the preview shows X" could be satisfied by sample
 * substitution and would prove nothing about resolution.
 */
const FAKE_RECIPIENTS: Record<string, Record<string, string>> = {
  "you@example.com": { first_name: "Grace", plan_name: "pro" },
  "teammate@example.com": { first_name: "Marie", plan_name: "free" },
};
const FAKE_DEFAULT: Record<string, string> = {
  first_name: "Grace",
  plan_name: "pro",
};

/**
 * Evaluates `{% if … %}` … `{% endif %}` blocks, keeping the body when the
 * condition holds and dropping it otherwise. Handles both the bare form
 * (`{% if vip %}`) and the comparison the showcase templates use
 * (`{% if plan_name == 'pro' %}`).
 *
 * Intentionally minimal — a real resolver would use a template engine on the
 * server. What matters for the demo is that logic tags **disappear** from a
 * resolved preview, which is the one thing `MergeTag.sample` can never do.
 */
function evaluateLiquidLogic(
  html: string,
  data: Record<string, string>,
): string {
  const IF_BLOCK =
    /<span data-logic-merge-tag="\{%\s*if\s+([^"%]+?)\s*%\}"[^>]*>.*?<\/span>([\s\S]*?)<span data-logic-merge-tag="\{%\s*endif\s*%\}"[^>]*>.*?<\/span>/g;

  return html.replace(IF_BLOCK, (_m, condition: string, body: string) => {
    // Quotes may arrive plain (`'pro'`) or entity-encoded (`&#39;pro&#39;`)
    // depending on how the content was authored, so accept both. An earlier
    // version required the entity form, which meant every comparison fell
    // through to the truthiness branch and *both* arms of an if/else were
    // dropped — the blue block rendered empty.
    const QUOTE = "(?:&#0?39;|&#x27;|&quot;|[\"'])?";
    const comparison = condition.match(
      new RegExp(`^([\\w.]+)\\s*(==|!=)\\s*${QUOTE}(.*?)${QUOTE}$`),
    );

    if (comparison) {
      const [, name, op, expected] = comparison;
      const matches = data[name!] === expected;
      return (op === "==" ? matches : !matches) ? body : "";
    }

    // Bare `{% if vip %}` — plain truthiness.
    return data[condition.trim()] ? body : "";
  });
}

const resolvePreviewDemo = async ({
  content,
  recipient,
}: PreviewResolveContext): Promise<TemplateContent> => {
  await new Promise((r) => setTimeout(r, FAKE_RESOLVE_LATENCY_MS));

  const data = (recipient && FAKE_RECIPIENTS[recipient]) || FAKE_DEFAULT;

  const resolveHtml = (html: string): string => {
    let out = evaluateLiquidLogic(html, data);
    // Spans FIRST, then bare tokens. The other order rewrites the token inside
    // `data-merge-tag="{{x}}"`, which corrupts the attribute so the span no
    // longer matches — the chip then survives and the editor renders the
    // mangled attribute as the tag's label.
    out = out.replace(
      /<span data-merge-tag="\{\{(\w+)\}\}"[^>]*>.*?<\/span>/g,
      (m, name: string) => data[name] ?? m,
    );
    for (const [key, value] of Object.entries(data)) {
      out = out.split(`{{${key}}}`).join(value);
    }
    return out;
  };

  const walk = (blocks: TemplateContent["blocks"]): TemplateContent["blocks"] =>
    blocks.map((block) => {
      if (block.type === "section") {
        return { ...block, children: block.children.map(walk) };
      }
      if (block.type === "title" || block.type === "paragraph") {
        return { ...block, content: resolveHtml(block.content) };
      }
      return block;
    });

  return { ...content, blocks: walk(content.blocks) };
};

/** Swapped on each template open; read by `init()` via the config below. */
let savedBlocksProvider: SavedBlocksProvider = savedBlocksProviderFor();
let templatesProvider: TemplatesProvider = templatesProviderFor();
let versionHistoryProvider: VersionHistoryProvider =
  versionHistoryProviderFor();
let commentsProvider: CommentsProvider = commentsProviderFor();

/** Which template's store the two providers above are bound to. */
let currentTemplateLabel = SCRATCH_TEMPLATE_NAME;

/**
 * The id `create()` handed back, or `null` before the first store.
 *
 * Reset on every chooser open, which is what makes a fresh open *store what was
 * chosen* while a re-init (locale or config change, which both re-run `init()`)
 * re-attaches to the same record. Opening "Product Launch" from the chooser
 * therefore gives you Product Launch, not last week's half-finished edit — and
 * an imported template can't be silently replaced by a previously stored one.
 */
let openedTemplateId: string | null = null;

type ExportTab = "mjml" | "html" | "json";
const exportTabs: readonly ExportTab[] = ["mjml", "html", "json"] as const;
const exportModalOpen = ref(false);
const exportTab = ref<ExportTab>("mjml");
const exportJson = ref("");
const exportMjml = ref("");
const exportHtml = ref("");
const exportHtmlLoading = ref(false);
const exportHtmlError = ref("");
const exportHtmlMjmlErrors = ref<string[]>([]);

const configTabs = [
  "options",
  "content",
  "theme",
  "defaults",
  "callbacks",
  "locale",
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
const enableRequestMedia = ref(
  localStorage.getItem("tpl-playground-media") !== "false",
);
const enableRequestMergeTag = ref(true);

// --- Block & Template Defaults ---

interface DefaultsPreset {
  key: string;
  blockDefaults: BlockDefaults;
  templateDefaults: TemplateDefaults;
}

const defaultsPresets: DefaultsPreset[] = [
  {
    // "Templatical Default" means *no* overrides — the SDK's own defaults, as a
    // consumer who passes neither key would get them. It used to restate
    // DEFAULT_BLOCK_DEFAULTS / DEFAULT_TEMPLATE_DEFAULTS verbatim, which reads
    // as harmless but is not: a consumer value wins over the SDK's, so pinning
    // the English placeholder text here overrode the localized defaults and
    // pinned `settings.locale` to "en" — making this app unable to demonstrate
    // either, which is exactly what it exists to do.
    key: "templatical",
    blockDefaults: {},
    templateDefaults: {},
  },
  {
    key: "corporate",
    blockDefaults: {
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

const mergeTagList = computed<MergeTag[]>(() => {
  const tags = t.value.mergeTags;
  return [
    {
      label: tags.firstName,
      value: "{{first_name}}",
      sample: "Ada",
      group: tags.groups.recipient,
      description: tags.descriptions.firstName,
    },
    {
      label: tags.lastName,
      value: "{{last_name}}",
      // Deliberately sample-less. Order Confirmation renders it as a span right
      // beside {{first_name}}, so the demo shows both halves of the per-tag rule
      // in one line: the sampled tag as plain text, this one still highlighted.
      group: tags.groups.recipient,
      description: tags.descriptions.lastName,
    },
    {
      label: tags.email,
      value: "{{email}}",
      sample: "ada@example.com",
      group: tags.groups.recipient,
      description: tags.descriptions.email,
    },
    {
      label: tags.company,
      value: "{{company}}",
      sample: "Analytical Engines Ltd",
      group: tags.groups.account,
      description: tags.descriptions.company,
    },
    {
      label: tags.accountId,
      value: "{{account_id}}",
      sample: "AC-4815162342",
      group: tags.groups.account,
      description: tags.descriptions.accountId,
    },
    {
      label: tags.planName,
      value: "{{plan_name}}",
      sample: "Pro",
      group: tags.groups.account,
      description: tags.descriptions.planName,
    },
    {
      label: tags.orderId,
      value: "{{order_id}}",
      sample: "TPL-90210",
      group: tags.groups.order,
      description: tags.descriptions.orderId,
    },
    {
      label: tags.orderTotal,
      value: "{{order_total}}",
      sample: "$148.00",
      group: tags.groups.order,
      description: tags.descriptions.orderTotal,
    },
    {
      label: tags.shippingMethod,
      value: "{{shipping_method}}",
      sample: "Express (2 days)",
      group: tags.groups.order,
      description: tags.descriptions.shippingMethod,
    },
    {
      label: tags.estimatedDelivery,
      value: "{{estimated_delivery}}",
      sample: "Thursday, 6 August",
      group: tags.groups.order,
      description: tags.descriptions.estimatedDelivery,
    },
    {
      label: tags.trackingUrl,
      value: "{{tracking_url}}",
      sample: "https://track.example.com/TPL-90210",
      group: tags.groups.order,
      description: tags.descriptions.trackingUrl,
    },
    {
      label: tags.unsubscribeUrl,
      value: "{{unsubscribe_url}}",
      sample: "https://example.com/unsubscribe",
      group: tags.groups.system,
      description: tags.descriptions.unsubscribeUrl,
    },
    {
      label: tags.preferencesUrl,
      value: "{{preferences_url}}",
      group: tags.groups.system,
      description: tags.descriptions.preferencesUrl,
    },
    {
      label: tags.currentDate,
      value: "{{current_date}}",
      group: tags.groups.system,
      description: tags.descriptions.currentDate,
    },
  ];
});

// Standalone logic tags — separate from merge tags. `tags` are inserted at the
// cursor; `pairs` (Blocks) wrap the selection. Surfaced via the built-in logic
// picker ("Insert logic" toolbar button).
const logicList = computed<LogicTagsConfig>(() => {
  const l = t.value.logic;
  return {
    tags: [
      {
        label: l.else,
        value: "{% else %}",
        group: l.conditionsGroup,
        description: l.elseDescription,
      },
      {
        label: l.break,
        value: "{% break %}",
        group: l.loopsGroup,
        description: l.breakDescription,
      },
      {
        label: l.continue,
        value: "{% continue %}",
        group: l.loopsGroup,
        description: l.continueDescription,
      },
    ],
    pairs: [
      {
        label: l.ifVip,
        before: "{% if customer.vip %}",
        after: "{% endif %}",
        group: l.conditionsGroup,
        description: l.ifVipDescription,
      },
      {
        label: l.loopItems,
        before: "{% for item in order.items %}",
        after: "{% endfor %}",
        group: l.loopsGroup,
        description: l.loopItemsDescription,
      },
    ],
  };
});

function requestMergeTag(): Promise<MergeTag | null> {
  return new Promise((resolve) => {
    mergeTagResolve = resolve;
    mergeTagPickerOpen.value = true;
  });
}

// Showcase: the consumer-owned `onRequest` modal mirrors the SDK's
// built-in picker — grouping by `group`, helper text below each row.
// Helps consumers reading the playground discover both fields without
// flipping the toggle to the static-tags path.
type MergeTagPickerRow =
  | { kind: "header"; group: string; count: number }
  | { kind: "tag"; tag: MergeTag };

const mergeTagPickerRows = computed<MergeTagPickerRow[]>(() => {
  const tags = mergeTagList.value;
  const hasGroups = tags.some((tag) => Boolean(tag.group));
  if (!hasGroups) {
    return tags.map((tag) => ({ kind: "tag", tag }));
  }
  const otherLabel = t.value.mergeTags.groups.system;
  const buckets = new Map<string, MergeTag[]>();
  const order: string[] = [];
  for (const tag of tags) {
    const key = tag.group ?? otherLabel;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(tag);
  }
  const rows: MergeTagPickerRow[] = [];
  for (const group of order) {
    const items = buckets.get(group)!;
    rows.push({ kind: "header", group, count: items.length });
    for (const tag of items) {
      rows.push({ kind: "tag", tag });
    }
  }
  return rows;
});

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
let currentHtmlBlockPreview: boolean | undefined;
/**
 * Per-template opt-in for `resolvePreview`. Only one template wires it: a
 * configured resolver supersedes `MergeTag.sample`, so a playground-wide
 * resolver would hide the Sample/Label switch everywhere and leave that feature
 * undemonstrable.
 */
let currentResolvePreview: boolean | undefined;
let currentFonts: FontsConfig | undefined;
let currentColors: ColorsConfig | undefined;
// Per-template block/template defaults (Event Invitation's on-brand set). When
// set they fully replace the app-level DefaultsPreset selection for this
// template — resolved in `initEditor`, same override idiom as `currentColors`.
let currentTemplateBlockDefaults: BlockDefaults | undefined;
let currentTemplateTemplateDefaults: TemplateDefaults | undefined;
let pendingEditorInit = false;

function chooseTemplate(
  content: TemplateContent,
  template?: TemplateOption,
): void {
  selectedContent = content;
  selectedCustomBlocks = template?.customBlocks;
  // Per-template saved-blocks library, seeded on first open. Memoised by name,
  // so a later locale/config re-init reuses the same instance rather than
  // resetting what the user saved.
  savedBlocksProvider = savedBlocksProviderFor(template);
  // Per-template stored document, memoised the same way. `openedTemplateId` is
  // cleared so the first `init()` after this stores the content just chosen.
  currentTemplateLabel = template?.name ?? SCRATCH_TEMPLATE_NAME;
  templatesProvider = templatesProviderFor(template);
  // Same store the templates provider appends to, memoised the same way.
  versionHistoryProvider = versionHistoryProviderFor(template);
  // Per-template conversation, memoised the same way.
  commentsProvider = commentsProviderFor(template);
  openedTemplateId = null;
  // Per-template opt-in for the SDK's live HTML-block preview; reset on each
  // template open so other templates keep the default static placeholder.
  currentHtmlBlockPreview = template?.htmlBlockPreview;
  // Reset on each open so every other template keeps showing sample values.
  currentResolvePreview = template?.resolvePreview;
  // Per-template `fonts` config (e.g. the Newsletter curated-font-list demo);
  // reset on each open so other templates keep the full built-in font list.
  currentFonts = template?.fonts;
  // Per-template `colors` palette (e.g. the Event Invitation brand-lock demo);
  // reset on each open so other templates keep the default free-form pickers.
  currentColors = template?.colors;
  // Per-template defaults, reset on each open. When a template sets its own,
  // they shadow the app-level DefaultsPreset selector (see initEditor).
  currentTemplateBlockDefaults = template?.blockDefaults;
  currentTemplateTemplateDefaults = template?.templateDefaults;
  // A template can opt out of the playground's consumer-owned `onRequest`
  // modal — that's how the Welcome Email template demos the SDK's built-in
  // picker without making the user flip a config toggle. The flag is
  // applied per template-open; flipping it back is the user's choice via
  // the Config modal.
  if (template?.useBuiltInMergeTagPicker) {
    enableRequestMergeTag.value = false;
  }
  currentSerializableConfig = buildSerializableConfig();
  pendingEditorInit = true;
  screen.value = "editor";
}

function onScreenEnter(): void {
  if (pendingEditorInit) {
    pendingEditorInit = false;
    nextTick(() => {
      initEditor();
    });
  }
}

function closeImportModal(): void {
  showImport.value = false;
  beefreeError.value = "";
  unlayerError.value = "";
  htmlError.value = "";
  mjmlError.value = "";
  topolError.value = "";
  stripoError.value = "";
  chamaileonError.value = "";
  easyEmailProError.value = "";
}

function _openImportFromSource(source: ImportSource): void {
  importSource.value = source;
  showImport.value = true;
}

async function importBeefreeFromJson(raw: string): Promise<void> {
  beefreeError.value = "";

  try {
    const json = JSON.parse(raw);
    const { convertBeeFreeTemplate } =
      await import("@templatical/import-beefree");
    const { content } = convertBeeFreeTemplate(json);
    closeImportModal();
    beefreeJson.value = "";
    chooseTemplate(content);
  } catch (e) {
    beefreeError.value = e instanceof Error ? e.message : "Invalid JSON";
  }
}

async function importUnlayerFromJson(raw: string): Promise<void> {
  unlayerError.value = "";

  try {
    const json = JSON.parse(raw);
    const { convertUnlayerTemplate } =
      await import("@templatical/import-unlayer");
    const { content } = convertUnlayerTemplate(json);
    closeImportModal();
    unlayerJson.value = "";
    chooseTemplate(content);
  } catch (e) {
    unlayerError.value = e instanceof Error ? e.message : "Invalid JSON";
  }
}

async function importHtmlFromString(raw: string): Promise<void> {
  htmlError.value = "";

  try {
    const { convertHtmlTemplate } = await import("@templatical/import-html");
    const { content } = convertHtmlTemplate(raw);
    closeImportModal();
    htmlSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    htmlError.value = e instanceof Error ? e.message : "Invalid HTML";
  }
}

async function importMjmlFromString(raw: string): Promise<void> {
  mjmlError.value = "";

  try {
    const { convertMjmlTemplate } = await import("@templatical/import-mjml");
    const { content } = convertMjmlTemplate(raw);
    closeImportModal();
    mjmlSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    mjmlError.value = e instanceof Error ? e.message : "Invalid MJML";
  }
}

async function importTopolFromString(raw: string): Promise<void> {
  topolError.value = "";

  try {
    const { convertTopolTemplate } = await import("@templatical/import-topol");
    const { content } = convertTopolTemplate(raw);
    closeImportModal();
    topolSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    topolError.value = e instanceof Error ? e.message : "Invalid Topol JSON";
  }
}

async function importStripoFromString(raw: string): Promise<void> {
  stripoError.value = "";

  try {
    let html = raw;
    let css: string | undefined;
    if (raw.trimStart().startsWith("{")) {
      const obj = JSON.parse(raw) as { html?: unknown; css?: unknown };
      if (typeof obj.html === "string") {
        html = obj.html;
        css = typeof obj.css === "string" ? obj.css : undefined;
      }
    }
    const { convertStripoTemplate } =
      await import("@templatical/import-stripo");
    const { content } = convertStripoTemplate(html, css ? { css } : undefined);
    closeImportModal();
    stripoSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    stripoError.value = e instanceof Error ? e.message : "Invalid Stripo HTML";
  }
}

async function importChamaileonFromString(raw: string): Promise<void> {
  chamaileonError.value = "";

  try {
    const { convertChamaileonTemplate } =
      await import("@templatical/import-chamaileon");
    const { content } = convertChamaileonTemplate(raw);
    closeImportModal();
    chamaileonSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    chamaileonError.value =
      e instanceof Error ? e.message : "Invalid Chamaileon JSON";
  }
}

async function importEasyEmailProFromString(raw: string): Promise<void> {
  easyEmailProError.value = "";
  try {
    const { convertEasyEmailProTemplate } =
      await import("@templatical/import-easy-email-pro");
    const { content } = convertEasyEmailProTemplate(raw);
    closeImportModal();
    easyEmailProSource.value = "";
    chooseTemplate(content);
  } catch (e) {
    easyEmailProError.value =
      e instanceof Error ? e.message : "Invalid Easy Email Pro JSON";
  }
}

function confirmImport(): void {
  if (importSource.value === "beefree") {
    const raw = beefreeJson.value.trim();
    if (!raw) {
      beefreeError.value = t.value.importModal.beefree.emptyError;
      return;
    }
    importBeefreeFromJson(raw);
    return;
  }

  if (importSource.value === "html") {
    const raw = htmlSource.value.trim();
    if (!raw) {
      htmlError.value = t.value.importModal.html.emptyError;
      return;
    }
    importHtmlFromString(raw);
    return;
  }

  if (importSource.value === "mjml") {
    const raw = mjmlSource.value.trim();
    if (!raw) {
      mjmlError.value = t.value.importModal.mjml.emptyError;
      return;
    }
    importMjmlFromString(raw);
    return;
  }

  if (importSource.value === "topol") {
    const raw = topolSource.value.trim();
    if (!raw) {
      topolError.value = t.value.importModal.topol.emptyError;
      return;
    }
    importTopolFromString(raw);
    return;
  }

  if (importSource.value === "stripo") {
    const raw = stripoSource.value.trim();
    if (!raw) {
      stripoError.value = t.value.importModal.stripo.emptyError;
      return;
    }
    importStripoFromString(raw);
    return;
  }

  if (importSource.value === "chamaileon") {
    const raw = chamaileonSource.value.trim();
    if (!raw) {
      chamaileonError.value = t.value.importModal.chamaileon.emptyError;
      return;
    }
    importChamaileonFromString(raw);
    return;
  }

  if (importSource.value === "easyEmailPro") {
    const raw = easyEmailProSource.value.trim();
    if (!raw) {
      easyEmailProError.value = t.value.importModal.easyEmailPro.emptyError;
      return;
    }
    importEasyEmailProFromString(raw);
    return;
  }

  const raw = unlayerJson.value.trim();
  if (!raw) {
    unlayerError.value = t.value.importModal.unlayer.emptyError;
    return;
  }
  importUnlayerFromJson(raw);
}

const { open: openImportFile, onChange: onImportFileChange } = useFileDialog({
  accept: ".json,.html,.htm,.mjml",
  multiple: false,
});

onImportFileChange(async (files) => {
  const file = files?.[0];
  if (!file) return;
  const text = await file.text();
  if (importSource.value === "beefree") {
    importBeefreeFromJson(text);
  } else if (importSource.value === "html") {
    importHtmlFromString(text);
  } else if (importSource.value === "mjml") {
    importMjmlFromString(text);
  } else if (importSource.value === "topol") {
    importTopolFromString(text);
  } else if (importSource.value === "stripo") {
    importStripoFromString(text);
  } else if (importSource.value === "chamaileon") {
    importChamaileonFromString(text);
  } else if (importSource.value === "easyEmailPro") {
    importEasyEmailProFromString(text);
  } else {
    importUnlayerFromJson(text);
  }
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

/**
 * `tpl-playground-theme-override` / `…-dark-override` seed a distinctive
 * `theme` before the first `init()`, as a JSON patch over the defaults above.
 *
 * The playground's own defaults deliberately mirror the SDK's stock tokens, so
 * a themed editor is pixel-identical to an unthemed one — which makes every
 * "does the theme reach here?" assertion vacuous. e2e needs a value that could
 * only have come from `theme`. Editing the Config panel would do it, but that
 * panel is a CodeMirror instance and driving it from Playwright is far more
 * fragile than the config it is setting. Same shape as the saved-blocks
 * `…-readonly` / `…-delay` flags: storage-only, no UI, invisible to visitors.
 */
function readThemeOverride(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

let currentTheme: Record<string, string> = {
  ...defaultTheme,
  ...readThemeOverride("tpl-playground-theme-override"),
};
let currentDarkTheme: Record<string, string> = {
  ...defaultDarkTheme,
  ...readThemeOverride("tpl-playground-dark-theme-override"),
};

/**
 * `tpl-playground-settings-fields` narrows the Settings panel before the first
 * `init()` — a comma-separated allowlist of `TemplateSettings` members
 * (`"width,backgroundColor"`), or the literal `none` for `fields: false`.
 *
 * Storage-only, no UI, invisible to visitors — the same shape as the
 * saved-blocks `…-readonly` flag. Absent means the key is omitted entirely,
 * which is the case that has to keep every setting editable, so the demo's
 * default is the SDK's default rather than some restricted variant.
 */
function readTemplateSettingsConfig(): TemplateSettingsConfig | undefined {
  const raw = localStorage.getItem("tpl-playground-settings-fields");
  if (!raw) return undefined;
  if (raw === "none") return { fields: false };
  // Cast, not validate: the flag is free text, and an entry that isn't a
  // template setting is exactly what the SDK's own warn-and-skip path covers.
  // Validating here would hide that path from the e2e that exercises it.
  return {
    fields: raw.split(",").map((entry) => entry.trim()),
  } as TemplateSettingsConfig;
}

const currentTemplateSettings = readTemplateSettingsConfig();

function buildSerializableConfig() {
  return {
    content: selectedContent ?? createDefaultTemplateContent(),
    mergeTags: { syntax: "liquid" as const, tags: mergeTagList.value },
    logicTags: logicList.value,
    displayConditions,
    customBlocks:
      selectedCustomBlocks !== undefined
        ? selectedCustomBlocks
        : customBlockDefinitions,
  };
}

let currentSerializableConfig = buildSerializableConfig();

const initError = ref("");

// Shadow DOM mount mode. Resolution lives in `host/shadowMode.ts` so SceneHost
// and this leftover chooser share one `?shadowDom=` → localStorage → `'shadow'`
// order. The header toggle still mutates the ref + localStorage and re-inits.
const shadowDomMode = ref<"shadow" | "light">(resolveInitialShadowMode());

async function cycleShadowDom(): Promise<void> {
  const newMode = shadowDomMode.value === "shadow" ? "light" : "shadow";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SHADOW_STORAGE_KEY, newMode);
  }
  if (editor.value) {
    // Once `attachShadow()` runs on a host element, the shadow root is
    // permanent — even after Vue unmount, the (now empty) shadow tree
    // suppresses light-DOM children. So we must tear down the current
    // editor AND force Vue to recreate the container element via a `:key`
    // bump, then re-init on the fresh node.
    editor.value.unmount();
    editor.value = null;
    shadowDomMode.value = newMode;
    await nextTick();
    await initEditor();
  } else {
    shadowDomMode.value = newMode;
  }
}

/**
 * Give the editor a template to save into.
 *
 * A read-only demo store (`create: false`) has nothing to attach to, so this
 * gives up quietly — the editor still edits, it just can't persist, which is the
 * whole point of that flag.
 */
async function adoptTemplate(): Promise<void> {
  if (!editor.value) return;
  try {
    if (openedTemplateId) {
      await editor.value.load(openedTemplateId);
    } else {
      const created = await editor.value.create({
        name: currentTemplateLabel,
      });
      openedTemplateId = created.id;
    }
  } catch (err) {
    console.info("[playground] no template attached:", (err as Error).message);
  }
}

async function initEditor(): Promise<void> {
  if (!editorContainer.value) return;

  initError.value = "";
  const shadowDom = shadowDomMode.value === "shadow";
  try {
    editor.value = await init({
      container: editorContainer.value,
      shadowDom,
      ...currentSerializableConfig,
      mergeTags: {
        ...currentSerializableConfig.mergeTags,
        onRequest: enableRequestMergeTag.value ? requestMergeTag : undefined,
      },
      // A template's own defaults (Event Invitation) shadow the app-level
      // DefaultsPreset selector; every other template uses the preset value.
      blockDefaults: currentTemplateBlockDefaults ?? currentBlockDefaults,
      templateDefaults:
        currentTemplateTemplateDefaults ?? currentTemplateDefaults,
      htmlBlockPreview: currentHtmlBlockPreview,
      fonts: currentFonts,
      colors: currentColors,
      templateSettings: currentTemplateSettings,
      theme: { ...currentTheme, dark: currentDarkTheme },
      uiTheme: uiTheme.value,
      locale: sdkLocale.value,
      // Media library when the flag is on — the bundled localStorage adapter,
      // with `onRequestMedia` left unset so Browse opens the real modal.
      // Off omits both keys: image fields stay URL-only (e2e coverage).
      ...(enableRequestMedia.value ? { media: mediaProviderFor() } : {}),
      // Always on in the playground: saved blocks are backed by the bundled
      // browser-local provider, so the OSS path is exercised on every run
      // without needing a backend. Entries persist in this browser profile.
      savedBlocks: savedBlocksProvider,
      // Also always on, and also backend-free — the provider fakes delivery so
      // the send/success/error path is exercisable on every template.
      testEmail: testEmailProvider,
      // Always on too: one localStorage record per template stands in for a real
      // API, so the header's name field, save button and status indicator are
      // exercised on every run. Autosave is opt-in via a storage flag, because a
      // demo that saves by itself hides what the Save button does.
      templates: {
        ...templatesProvider,
        autoSave:
          localStorage.getItem("tpl-playground-templates-autosave") === "true",
      },
      // Always on too: the templates provider above records a version on every
      // save, so history fills up as you work and the header control is
      // exercised on every run.
      versionHistory: versionHistoryProvider,
      // Always on too: one localStorage array per template stands in for a review
      // backend. `user` is what makes it available at all — without an identity the
      // feature reports itself unavailable rather than writing anonymous comments.
      comments: commentsProvider,
      user: PLAYGROUND_USER,
      // Only `compileMjml`, deliberately: the playground demonstrates the tier a
      // consumer with no Node backend can reach. MJML still comes from the SDK's
      // own renderer, and this one function is what turns it into HTML.
      render: { compileMjml: compileMjmlDemo },
      resolvePreview: currentResolvePreview ? resolvePreviewDemo : undefined,
    });
    // A real consumer does exactly this: mount, then attach a template. First
    // open stores what the chooser handed us; a re-init re-reads that record.
    await adoptTemplate();
    // E2E affordance: expose `editor.toMjml()` / `toHtml()` on window so
    // Playwright tests can read the export-path output without depending on the
    // playground's copy-to-clipboard UI (the clipboard API is unreliable in
    // headless Chromium on Linux CI — see
    // `apps/playground/e2e/tests/custom-block-stylesheet.spec.ts`).
    // The playground is a dev/demo harness, not a shipped product, so a
    // test hook here is on-mission.
    const testHooks = window as {
      __tplPlaygroundGetMjml?: () => Promise<string>;
      __tplPlaygroundGetHtml?: () => Promise<string>;
    };
    testHooks.__tplPlaygroundGetMjml = () =>
      editor.value?.toMjml() ?? Promise.resolve("");
    testHooks.__tplPlaygroundGetHtml = () =>
      editor.value?.toHtml() ?? Promise.resolve("");
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

// --- Share ---
const shareModalOpen = ref(false);
const shareUrl = ref("");
const shareLoading = ref(false);
const shareError = ref("");

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

onMounted(() => {
  window.addEventListener("popstate", syncPlaygroundLocation);
});

// --- Focus traps for modals (useFocusTrap) ---
const trapOpts = { allowOutsideClick: true, escapeDeactivates: false };

function useModalTrap(isOpen: typeof showConfig | typeof exportTabValue) {
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

const configModalRef = useModalTrap(showConfig);
const importModalRef = useModalTrap(showImport);
const mergeTagModalRef = useModalTrap(mergeTagPickerOpen);
const dataSourceModalRef = useModalTrap(
  computed(() => dataSourcePickerOpen.value && !!dataSourcePickerRequest.value),
);
const shareModalRef = useModalTrap(shareModalOpen);
const exportModalRef = useModalTrap(exportModalOpen);

// --- Lock body scroll when any modal is open ---
const bodyScrollLocked = useScrollLock(document.body);
watch(
  () =>
    showConfig.value ||
    showImport.value ||
    mergeTagPickerOpen.value ||
    (dataSourcePickerOpen.value && !!dataSourcePickerRequest.value) ||
    shareModalOpen.value ||
    exportModalOpen.value,
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

const { copy: copyExport, copied: exportCopied } = useClipboard({
  copiedDuring: 1500,
});

const exportTabValue = computed<string>(() => {
  if (exportTab.value === "html") return exportHtml.value;
  if (exportTab.value === "mjml") return exportMjml.value;
  return exportJson.value;
});

const exportFilename: Record<ExportTab, { name: string; mime: string }> = {
  html: { name: "email-template.html", mime: "text/html" },
  mjml: { name: "email-template.mjml", mime: "text/plain" },
  json: { name: "email-template.json", mime: "application/json" },
};

/**
 * Demo `render.compileMjml`: MJML in, HTML out.
 *
 * This is the **cheap tier** of the render provider, and the whole reason the
 * contract has three methods. The playground has no backend at all — it compiles
 * in the browser with `mjml-browser` — yet wiring up this one function is enough
 * for `editor.toHtml()` to work, because the SDK still renders the MJML itself.
 * A non-Node backend does the same thing with any mjml2html endpoint instead of
 * standing up a Node sidecar to understand the block model.
 */
async function compileExportHtml(): Promise<void> {
  if (!editor.value || exportHtml.value || exportHtmlLoading.value) return;
  exportHtmlLoading.value = true;
  exportHtmlError.value = "";
  exportHtmlMjmlErrors.value = [];
  try {
    // `toHtml()` — not a local mjml2html call. It renders MJML through the SDK,
    // then hands it to `render.compileMjml` above. Rejects with an explanatory
    // error if the `render` provider is ever dropped, since there is no local HTML
    // path.
    exportHtml.value = await editor.value.toHtml();
    exportHtmlMjmlErrors.value = [...getLastMjmlWarnings()];
  } catch (e) {
    exportHtmlError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exportHtmlLoading.value = false;
  }
}

function focusExportTab(delta: number): void {
  const idx = exportTabs.indexOf(exportTab.value);
  const next = (idx + delta + exportTabs.length) % exportTabs.length;
  exportTab.value = exportTabs[next];
  nextTick(() => {
    document.getElementById(`export-tab-${exportTabs[next]}`)?.focus();
  });
}

async function openExportModal(): Promise<void> {
  if (!editor.value) return;
  exportJson.value = JSON.stringify(editor.value.getContent(), null, 2);
  exportMjml.value = await editor.value.toMjml();
  exportHtml.value = "";
  exportHtmlError.value = "";
  exportHtmlMjmlErrors.value = [];
  exportTab.value = "mjml";
  exportModalOpen.value = true;
  void compileExportHtml();
}

function handleExportCopy(): void {
  copyExport(exportTabValue.value);
}

function handleExportDownload(): void {
  const { name, mime } = exportFilename[exportTab.value];
  downloadFile(exportTabValue.value, name, mime);
}

watch(exportTab, (tab) => {
  if (tab === "html") void compileExportHtml();
});

watch([locale, sdkLocale], () => {
  if (screen.value === "editor" && editor.value) {
    initEditor();
  }
});

watch(uiTheme, (theme) => {
  if (editor.value) {
    editor.value.setTheme(theme);
  }
});

onUnmounted(() => {
  window.removeEventListener("popstate", syncPlaygroundLocation);
  unmount();
});
</script>

<template>
  <SceneHost
    v-if="sceneRoute"
    :key="sceneRoute.id"
    :scene-id="sceneRoute.id"
    :search="sceneRoute.search"
  />
  <div
    v-else
    class="box-border flex flex-col min-h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  >
    <Transition name="pg-screen" mode="out-in" @enter="onScreenEnter">
      <Catalog v-if="screen === 'chooser'" key="chooser" />

      <!-- Editor Screen -->
      <div
        v-else
        key="editor"
        data-testid="editor-screen"
        class="flex flex-col h-screen"
      >
        <header
          class="flex items-center justify-between h-12 px-4 bg-gray-100 shrink-0 z-[100] dark:bg-gray-800 gap-2 overflow-x-auto"
        >
          <div class="flex items-center gap-2 shrink-0">
            <button
              data-testid="toolbar-back"
              class="pg-toolbar-btn no-underline"
              :title="t.a11y.backToTemplates"
              @click="backToChooser"
            >
              <ChevronLeft :size="16" :stroke-width="1.5" aria-hidden="true" />
              <span class="pg-toolbar-label">{{ t.toolbar.templates }}</span>
            </button>
            <button
              data-testid="toolbar-config"
              data-onboarding="config"
              class="pg-toolbar-btn"
              :title="t.toolbar.config"
              @click="openConfig"
            >
              <Crosshair :size="16" :stroke-width="1.5" aria-hidden="true" />
              <span class="pg-toolbar-label">{{ t.toolbar.config }}</span>
            </button>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <!-- Export button -->
            <button
              data-testid="toolbar-export"
              data-onboarding="export"
              class="pg-toolbar-btn"
              :title="t.toolbar.export"
              @click="openExportModal"
            >
              <Download :size="16" :stroke-width="1.5" aria-hidden="true" />
              <span class="pg-toolbar-label">{{ t.toolbar.export }}</span>
            </button>

            <button
              data-testid="toolbar-share"
              data-onboarding="share"
              class="pg-toolbar-btn"
              :title="t.toolbar.share"
              @click="handleShare"
            >
              <Upload :size="14" aria-hidden="true" />
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
              href="https://github.com/templatical/sdk"
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
              <Zap :size="12" aria-hidden="true" />
              <span class="pg-toolbar-label">{{ t.toolbar.tryCloud }}</span>
              <ChevronRight
                :size="10"
                aria-hidden="true"
                class="transition-transform duration-150 group-hover:translate-x-0.5 hidden sm:block"
              />
            </a>
            <button
              data-testid="toolbar-shadow-toggle"
              class="pg-toolbar-btn"
              :title="t.a11y.toggleShadowDom"
              :aria-label="t.a11y.toggleShadowDom"
              @click="cycleShadowDom"
            >
              <Layers
                v-if="shadowDomMode === 'shadow'"
                :size="14"
                aria-hidden="true"
              />
              <Square v-else :size="14" aria-hidden="true" />
              <span class="pg-toolbar-label">{{
                t.shadowMode[shadowDomMode]
              }}</span>
            </button>
            <button
              data-testid="toolbar-theme"
              class="pg-theme-btn"
              :title="t.theme[uiTheme]"
              :aria-label="t.a11y.selectTheme"
              @click="cycleTheme"
            >
              <Monitor
                v-if="uiTheme === 'auto'"
                :size="14"
                aria-hidden="true"
              />
              <Sun
                v-else-if="uiTheme === 'light'"
                :size="14"
                aria-hidden="true"
              />
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
          <!-- No `isolate` here, and don't add one back. `isolation: isolate`
               creates a stacking context, which confines the editor's popover
               root (z-index 10000) inside this element — so our own header,
               at z-index 100 in the parent context, painted OVER every editor
               modal. A `fixed` descendant cannot escape an isolated ancestor at
               any z-index, so the modal's top 15px sat behind the toolbar on
               any viewport under ~672px tall. That is the #575 follow-up.

               Nothing here needs the isolation: no descendant uses
               `mix-blend-mode`, and `overflow-hidden` already clips every
               non-fixed descendant geometrically, so paint order against the
               header only ever mattered for the fixed overlays we want on top.
               Guarded by `apps/playground/e2e/tests/modal-stacking.spec.ts`. -->
          <div
            v-else
            :key="shadowDomMode"
            ref="editorContainer"
            data-testid="editor-container"
            data-onboarding="canvas"
            class="flex-1 min-w-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700"
          />
        </main>
      </div>
    </Transition>

    <!-- Export Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="exportModalOpen"
          class="pg-modal-backdrop"
          @click.self="exportModalOpen = false"
          @keydown.escape="exportModalOpen = false"
        >
          <div
            ref="exportModalRef"
            data-testid="export-modal"
            role="dialog"
            aria-modal="true"
            :aria-label="t.exportModal.title"
            class="pg-modal-dialog w-[820px] max-w-[92vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <div
                role="tablist"
                :aria-label="t.exportModal.title"
                class="flex items-center gap-1"
                @keydown.arrow-right.prevent="focusExportTab(1)"
                @keydown.arrow-left.prevent="focusExportTab(-1)"
              >
                <button
                  v-for="tab in exportTabs"
                  :id="`export-tab-${tab}`"
                  :key="tab"
                  role="tab"
                  :aria-selected="exportTab === tab"
                  :aria-controls="`export-panel-${tab}`"
                  :tabindex="exportTab === tab ? 0 : -1"
                  :data-testid="`export-tab-${tab}`"
                  class="pg-tab h-8 px-3 text-[13px]"
                  :class="
                    exportTab === tab
                      ? 'pg-tab-active'
                      : 'pg-tab-inactive text-gray-500 dark:text-gray-400'
                  "
                  @click="exportTab = tab"
                >
                  {{ t.exportModal.tabs[tab] }}
                </button>
              </div>
              <button
                :aria-label="t.common.close"
                class="pg-modal-close"
                data-testid="export-modal-close"
                @click="exportModalOpen = false"
              >
                &times;
              </button>
            </div>

            <div
              :id="`export-panel-${exportTab}`"
              role="tabpanel"
              :aria-labelledby="`export-tab-${exportTab}`"
              class="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3"
            >
              <p class="text-[12px] text-gray-500 dark:text-gray-400 m-0">
                {{ t.exportModal.description[exportTab] }}
              </p>

              <div
                v-if="exportTab === 'html' && exportHtmlLoading"
                role="status"
                class="flex items-center gap-2 justify-center text-sm text-gray-500 h-[min(480px,60vh)] border border-gray-200 rounded-lg dark:text-gray-400 dark:border-gray-700"
              >
                <LoaderCircle
                  class="animate-spin h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <span>{{ t.exportModal.compiling }}</span>
              </div>

              <div
                v-else-if="exportTab === 'html' && exportHtmlError"
                data-testid="export-html-error"
                class="flex flex-col items-center justify-center gap-3 h-[min(480px,60vh)] border border-gray-200 rounded-lg dark:border-gray-700"
              >
                <p class="text-sm text-gray-500 dark:text-gray-400 m-0">
                  {{ t.exportModal.compileError }}
                </p>
                <p
                  class="text-[11px] font-mono text-gray-400 dark:text-gray-500 m-0 max-w-full break-words"
                >
                  {{ exportHtmlError }}
                </p>
                <button
                  class="pg-cta h-9 px-4 text-[13px] rounded-md"
                  @click="compileExportHtml"
                >
                  {{ t.exportModal.retry }}
                </button>
              </div>

              <CodeEditor
                v-else
                :model-value="exportTabValue"
                :aria-label="t.exportModal.title"
              />

              <div
                v-if="
                  exportTab === 'html' &&
                  !exportHtmlError &&
                  exportHtmlMjmlErrors.length
                "
                class="border border-gray-200 rounded-md p-3 dark:border-gray-700"
              >
                <p
                  class="text-[11px] font-semibold text-gray-600 dark:text-gray-400 m-0 mb-1"
                >
                  {{ t.exportModal.compileErrorDetails }}
                </p>
                <ul
                  class="text-[11px] font-mono text-gray-500 dark:text-gray-400 m-0 pl-4 list-disc"
                >
                  <li v-for="(msg, i) in exportHtmlMjmlErrors" :key="i">
                    {{ msg }}
                  </li>
                </ul>
              </div>
            </div>

            <div
              class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 shrink-0 dark:border-gray-700"
            >
              <button
                data-testid="export-copy"
                class="pg-cancel-btn"
                :disabled="!exportTabValue || exportHtmlLoading"
                @click="handleExportCopy"
              >
                <span aria-live="polite">{{
                  exportCopied ? t.exportModal.copied : t.exportModal.copy
                }}</span>
              </button>
              <button
                data-testid="export-download"
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                :disabled="!exportTabValue || exportHtmlLoading"
                @click="handleExportDownload"
              >
                {{ t.exportModal.download }}
              </button>
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
                <LoaderCircle
                  class="animate-spin h-5 w-5 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
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
                    data-testid="enable-media"
                  />
                  <div>
                    <span
                      class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
                      >media</span
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
                    data-testid="enable-on-request-merge-tag"
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
              <div
                v-show="configTab === 'locale'"
                :inert="configTab !== 'locale' || undefined"
                id="config-panel-locale"
                role="tabpanel"
                aria-labelledby="config-tab-locale"
                class="flex flex-col gap-4"
              >
                <p class="m-0 text-[13px] text-gray-500 dark:text-gray-400">
                  {{ t.configModal.localeHint }}
                </p>
                <label class="flex flex-col gap-1.5">
                  <span class="pg-form-label m-0">
                    {{ t.configModal.localeLabel }}
                  </span>
                  <select
                    v-model="sdkLocale"
                    data-testid="sdk-locale-select"
                    class="pg-locale-select w-auto self-start"
                  >
                    <option v-for="loc in sdkLocales" :key="loc" :value="loc">
                      {{ loc }}
                    </option>
                  </select>
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
                  data-testid="config-apply"
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

    <!-- Import Template Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="showImport"
          class="pg-modal-backdrop"
          @click.self="closeImportModal"
          @keydown.escape="closeImportModal"
        >
          <div
            ref="importModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            data-testid="import-modal"
            class="pg-modal-dialog w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-modal overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 dark:border-gray-700"
            >
              <div>
                <span
                  id="import-modal-title"
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >{{ t.importModal.title }}</span
                >
                <p class="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    importSource === "beefree"
                      ? t.importModal.beefree.description
                      : importSource === "html"
                        ? t.importModal.html.description
                        : importSource === "mjml"
                          ? t.importModal.mjml.description
                          : importSource === "topol"
                            ? t.importModal.topol.description
                            : importSource === "stripo"
                              ? t.importModal.stripo.description
                              : importSource === "chamaileon"
                                ? t.importModal.chamaileon.description
                                : importSource === "easyEmailPro"
                                  ? t.importModal.easyEmailPro.description
                                  : t.importModal.unlayer.description
                  }}
                </p>
              </div>
              <button
                :aria-label="t.common.close"
                class="pg-modal-close"
                @click="closeImportModal"
              >
                &times;
              </button>
            </div>
            <div
              role="tablist"
              :aria-label="t.importModal.title"
              class="flex gap-1 px-5 pt-3 border-b border-gray-200 dark:border-gray-700"
            >
              <button
                role="tab"
                :aria-selected="importSource === 'unlayer'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'unlayer'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-unlayer"
                @click="importSource = 'unlayer'"
              >
                {{ t.importModal.sources.unlayer }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'beefree'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'beefree'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-beefree"
                @click="importSource = 'beefree'"
              >
                {{ t.importModal.sources.beefree }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'stripo'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'stripo'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-stripo"
                @click="importSource = 'stripo'"
              >
                {{ t.importModal.sources.stripo }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'topol'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'topol'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-topol"
                @click="importSource = 'topol'"
              >
                {{ t.importModal.sources.topol }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'chamaileon'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'chamaileon'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-chamaileon"
                @click="importSource = 'chamaileon'"
              >
                {{ t.importModal.sources.chamaileon }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'easyEmailPro'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'easyEmailPro'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-easy-email-pro"
                @click="importSource = 'easyEmailPro'"
              >
                {{ t.importModal.sources.easyEmailPro }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'mjml'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'mjml'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-mjml"
                @click="importSource = 'mjml'"
              >
                {{ t.importModal.sources.mjml }}
              </button>
              <button
                role="tab"
                :aria-selected="importSource === 'html'"
                :class="[
                  'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  importSource === 'html'
                    ? 'border-primary text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                ]"
                data-testid="import-tab-html"
                @click="importSource = 'html'"
              >
                {{ t.importModal.sources.html }}
              </button>
            </div>
            <div class="flex-1 overflow-auto p-5">
              <button
                class="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 cursor-pointer transition-[border-color,color] duration-150 bg-transparent hover:border-primary hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:text-gray-100"
                @click="() => openImportFile()"
              >
                <Upload :size="24" :stroke-width="1.5" aria-hidden="true" />
                <span class="text-sm font-medium">{{
                  t.importModal.chooseFile
                }}</span>
              </button>

              <div
                class="flex items-center gap-4 my-4 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200 dark:text-gray-400 before:dark:bg-gray-700 after:dark:bg-gray-700"
              >
                <span>{{ t.importModal.orPaste }}</span>
              </div>

              <textarea
                v-if="importSource === 'beefree'"
                v-model="beefreeJson"
                :aria-label="t.a11y.beefreeJsonContent"
                data-testid="import-textarea-beefree"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"page": {"body": {...}, "rows": [...]}}'
              ></textarea>
              <textarea
                v-else-if="importSource === 'unlayer'"
                v-model="unlayerJson"
                :aria-label="t.a11y.unlayerJsonContent"
                data-testid="import-textarea-unlayer"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"body": {"rows": [...], "values": {...}}}'
              ></textarea>
              <textarea
                v-else-if="importSource === 'html'"
                v-model="htmlSource"
                :aria-label="t.a11y.htmlSourceContent"
                data-testid="import-textarea-html"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder="<!doctype html>&#10;<html>&#10;  <body>&#10;    <table>...</table>&#10;  </body>&#10;</html>"
              ></textarea>
              <textarea
                v-else-if="importSource === 'mjml'"
                v-model="mjmlSource"
                :aria-label="t.a11y.mjmlSourceContent"
                data-testid="import-textarea-mjml"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder="<mjml>&#10;  <mj-body>&#10;    <mj-section>...</mj-section>&#10;  </mj-body>&#10;</mjml>"
              ></textarea>
              <textarea
                v-else-if="importSource === 'topol'"
                v-model="topolSource"
                :aria-label="t.a11y.topolSourceContent"
                data-testid="import-textarea-topol"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"tagName": "mj-global-style", "children": [{"tagName": "mj-container", "children": [...]}]}'
              ></textarea>
              <textarea
                v-else-if="importSource === 'stripo'"
                v-model="stripoSource"
                :aria-label="t.a11y.stripoSourceContent"
                data-testid="import-textarea-stripo"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='<table class="es-wrapper">...</table>'
              ></textarea>
              <textarea
                v-else-if="importSource === 'chamaileon'"
                v-model="chamaileonSource"
                :aria-label="t.a11y.chamaileonSourceContent"
                data-testid="import-textarea-chamaileon"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"body": {"type": "body", "children": [{"type": "fullwidth", "children": [...]}]}}'
              ></textarea>
              <textarea
                v-else
                v-model="easyEmailProSource"
                :aria-label="t.a11y.easyEmailProSourceContent"
                data-testid="import-textarea-easy-email-pro"
                class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500 dark:bg-gray-700/50"
                placeholder='{"subject": "...", "content": {"type": "page", "children": [{"type": "standard-section", "children": [...]}]}}'
              ></textarea>
              <p
                v-if="importSource === 'beefree' && beefreeError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ beefreeError }}
              </p>
              <p
                v-if="importSource === 'unlayer' && unlayerError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ unlayerError }}
              </p>
              <p
                v-if="importSource === 'html' && htmlError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ htmlError }}
              </p>
              <p
                v-if="importSource === 'mjml' && mjmlError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ mjmlError }}
              </p>
              <p
                v-if="importSource === 'topol' && topolError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ topolError }}
              </p>
              <p
                v-if="importSource === 'stripo' && stripoError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ stripoError }}
              </p>
              <p
                v-if="importSource === 'chamaileon' && chamaileonError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ chamaileonError }}
              </p>
              <p
                v-if="importSource === 'easyEmailPro' && easyEmailProError"
                data-testid="import-error"
                class="mt-2 mb-0 text-[13px] text-red-500"
              >
                {{ easyEmailProError }}
              </p>
            </div>
            <div
              class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0 dark:border-gray-700"
            >
              <button class="pg-cancel-btn" @click="closeImportModal">
                {{ t.importModal.cancel }}
              </button>
              <button
                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                data-testid="import-confirm"
                @click="confirmImport"
              >
                {{ t.importModal.import }}
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
            data-testid="playground-merge-tag-modal"
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
              <template
                v-for="entry in mergeTagPickerRows"
                :key="
                  entry.kind === 'header' ? `h-${entry.group}` : entry.tag.value
                "
              >
                <div
                  v-if="entry.kind === 'header'"
                  class="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  {{ entry.group }}
                  <span class="ml-1.5 font-normal lowercase"
                    >({{ entry.count }})</span
                  >
                </div>
                <button
                  v-else
                  class="group flex flex-col items-start gap-1 w-full px-3 py-2.5 border-none bg-transparent rounded-lg cursor-pointer transition-[background] duration-[120ms] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-700"
                  @click="selectMergeTag(entry.tag)"
                >
                  <div class="flex w-full items-center justify-between">
                    <span
                      class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
                      >{{ entry.tag.label }}</span
                    >
                    <code
                      class="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:group-hover:bg-gray-600"
                      >{{ entry.tag.value }}</code
                    >
                  </div>
                  <span
                    v-if="entry.tag.description"
                    class="text-[11px] text-gray-500 dark:text-gray-400"
                    >{{ entry.tag.description }}</span
                  >
                </button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>

  <!-- Data Source Picker Modal — also used by example scene routes -->
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
            <LoaderCircle
              class="h-6 w-6 animate-spin text-primary"
              aria-hidden="true"
            />
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
              <ChevronRight
                class="shrink-0 text-gray-300 group-hover:text-primary transition-colors duration-150"
                :size="16"
                :stroke-width="1.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
