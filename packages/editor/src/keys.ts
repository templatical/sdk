import { inject, type InjectionKey, type ComputedRef, type Ref } from "vue";
import type {
  UseHistoryReturn,
  UseBlockActionsReturn,
  UseConditionPreviewReturn,
} from "@templatical/core";
import type {
  Block,
  BlockDefaults,
  CustomBlockDefinition,
  DisplayCondition,
  LogicPair,
  LogicTag,
  MergeTag,
  ResolvePreview,
  SyntaxPreset,
} from "@templatical/types";
import type { Translations, CloudTranslations } from "./i18n";
import type {
  AuthManager,
  UseAiConfigReturn,
  UseTemplateScoringReturn,
} from "@templatical/core/cloud";
import type { UseSavedBlocksReturn } from "@templatical/core";
import type { BaseEditorReturn } from "./composables/useEditorCore";
import type { ImageUrlResolver } from "./composables/useImageUrlResolver";
import type { UseFontsReturn } from "./composables/useFonts";
import type { UseBlockRegistryReturn } from "./composables/useBlockRegistry";
import type { UseKeyboardReorderReturn } from "./composables/useKeyboardReorder";
import type { EditorCapabilities } from "./types/editor-capabilities";
import type { OnRequestMedia } from "./index";

// ---------------------------------------------------------------------------
// Shared keys (provided by useEditorCore, consumed by all components)
// ---------------------------------------------------------------------------

export const TRANSLATIONS_KEY: InjectionKey<Translations> =
  Symbol("translations");

export const EDITOR_KEY: InjectionKey<BaseEditorReturn> = Symbol("editor");

export const HISTORY_KEY: InjectionKey<UseHistoryReturn> = Symbol("history");

export const BLOCK_ACTIONS_KEY: InjectionKey<UseBlockActionsReturn> =
  Symbol("blockActions");

export const CONDITION_PREVIEW_KEY: InjectionKey<UseConditionPreviewReturn> =
  Symbol("conditionPreview");

/**
 * Whether the hand-toggled display-condition filter applies on this surface —
 * provided per-surface, exactly like `USE_MERGE_TAG_SAMPLES_KEY`, and for the
 * same reason: the rule folds in both `previewMode` and whether a resolver owns
 * the preview, so a component that re-derived it from `CONDITION_PREVIEW_KEY`
 * plus the editor's `previewMode` could get one half wrong on its own.
 *
 * Absent means "applies" — a surface with no provider filters as it always has.
 */
export const APPLIES_CONDITION_FILTER_KEY: InjectionKey<ComputedRef<boolean>> =
  Symbol("appliesConditionFilter");

export const FONTS_MANAGER_KEY: InjectionKey<UseFontsReturn> =
  Symbol("fontsManager");

export const THEME_STYLES_KEY: InjectionKey<
  ComputedRef<Record<string, string>>
> = Symbol("themeStyles");

export const UI_THEME_KEY: InjectionKey<ComputedRef<string>> =
  Symbol("tplUiTheme");

export const BLOCK_DEFAULTS_KEY: InjectionKey<BlockDefaults | undefined> =
  Symbol("blockDefaults");

export const BLOCK_REGISTRY_KEY: InjectionKey<UseBlockRegistryReturn> =
  Symbol("blockRegistry");

export const CUSTOM_BLOCK_DEFINITIONS_KEY: InjectionKey<
  CustomBlockDefinition[]
> = Symbol("customBlockDefinitions");

/**
 * Consumer-supplied block-palette allowlist + order (`config.paletteBlocks`).
 * `undefined` means the default full palette. Consumed by `Sidebar.vue`.
 */
export const PALETTE_BLOCKS_KEY: InjectionKey<string[] | undefined> =
  Symbol("paletteBlocks");

/**
 * Consumer-supplied blocks rendered after the template's own, read-only
 * (`config.footerBlocks`). Never part of `getContent()`, so they cannot be
 * saved, exported or edited — they exist so an author can SEE what the host
 * application appends at send time. Consumed by `Canvas.vue`.
 */
export const FOOTER_BLOCKS_KEY: InjectionKey<Block[] | undefined> =
  Symbol("footerBlocks");

/**
 * Whether HTML blocks render a live sandboxed-iframe preview in the canvas
 * (`config.htmlBlockPreview`), normalized to a boolean. `false` (the default)
 * keeps the static placeholder card. Consumed by `HtmlBlock.vue`.
 */
export const HTML_BLOCK_PREVIEW_KEY: InjectionKey<boolean> =
  Symbol("htmlBlockPreview");

/**
 * Consumer-supplied color-picker palette (`config.colors`), normalized to
 * `{ presets, allowCustom, allowCustomIgnored }` by `resolveColorsConfig`.
 * Provided by `useEditorCore`, consumed by every `ColorPicker`. The inject
 * default (`DEFAULT_RESOLVED_COLORS` = `{ presets: [], allowCustom: true,
 * allowCustomIgnored: false }`) makes an unconfigured picker render exactly
 * as before.
 */
export const COLORS_KEY: InjectionKey<
  import("./utils/resolveColorsConfig").ResolvedColors
> = Symbol("colors");

export const CUSTOM_BLOCK_STYLESHEETS_KEY: InjectionKey<ComputedRef<string[]>> =
  Symbol("customBlockStylesheets");

export const MERGE_TAGS_KEY: InjectionKey<MergeTag[]> = Symbol("mergeTags");

export const MERGE_TAG_SYNTAX_KEY: InjectionKey<SyntaxPreset> =
  Symbol("mergeTagSyntax");

export const ON_REQUEST_MERGE_TAG_KEY: InjectionKey<
  (() => Promise<MergeTag | null>) | null
> = Symbol("onRequestMergeTag");

export const MERGE_TAG_AUTOCOMPLETE_KEY: InjectionKey<boolean> = Symbol(
  "mergeTagAutocomplete",
);

/**
 * The user's choice between the previews' two merge-tag views: `true` for
 * Sample (tags replaced by their `MergeTag.sample`, rendered as ordinary text)
 * and `false` for Label (tags shown as their label with the usual cue).
 *
 * Session state owned by `useEditorCore` and driven by a toggle that exists
 * only on preview surfaces. Defaults to Sample.
 */
export const MERGE_TAG_SAMPLE_MODE_KEY: InjectionKey<Ref<boolean>> =
  Symbol("mergeTagSampleMode");

/**
 * Whether **the current render surface** substitutes samples.
 *
 * Provided per surface rather than globally, and that is the whole point:
 * substitution must never happen while editing, so `Canvas.vue` folds in its
 * `previewMode` flag and provides `false` whenever the canvas is editable, no
 * matter what the mode ref says. Preview surfaces provide the mode directly.
 *
 * Block components inject **this** key. They must never read
 * `MERGE_TAG_SAMPLE_MODE_KEY`, which would bypass the editing guard.
 */
export const USE_MERGE_TAG_SAMPLES_KEY: InjectionKey<ComputedRef<boolean>> =
  Symbol("useMergeTagSamples");

/**
 * The `resolvePreview` seam — resolved content plus its loading and failure
 * state. Provided by `useEditorCore` so every preview surface shares one
 * lifecycle; `null` when the consumer configured no hook.
 *
 * Surfaces read `content` from here instead of `editor.content`, and gate the
 * Sample/Label toggle on `supersedesSamples`.
 */
/**
 * The raw `config.resolvePreview` hook.
 *
 * Provided alongside PREVIEW_RESOLUTION_KEY because the test-email dialog needs
 * its **own** resolution instance — it resolves for the selected recipient,
 * which the editor's canvas has no notion of — and so cannot reuse the shared
 * one. `undefined` when the consumer configured no hook.
 */
export const RESOLVE_PREVIEW_KEY: InjectionKey<ResolvePreview | undefined> =
  Symbol("resolvePreview");

export const PREVIEW_RESOLUTION_KEY: InjectionKey<
  import("./composables/usePreviewResolution").UsePreviewResolutionReturn | null
> = Symbol("previewResolution");

/**
 * Singleton state for the built-in merge tag picker modal. Provided by
 * `useEditorCore`, consumed by `useMergeTag.requestMergeTag()` (to open
 * the modal as a fall-through when only `mergeTags.tags` is configured)
 * and by `MergeTagPickerModal.vue` (to render and resolve).
 */
export const MERGE_TAG_PICKER_KEY: InjectionKey<
  import("./composables/useMergeTagPicker").UseMergeTagPickerReturn
> = Symbol("mergeTagPicker");

// ---------------------------------------------------------------------------
// Logic tags — a standalone feature, separate from merge tags. Native
// highlighting (LogicMergeTagNode) is always on; these drive the dedicated
// logic picker + insertion.
// ---------------------------------------------------------------------------

export const LOGIC_TAGS_KEY: InjectionKey<LogicTag[]> = Symbol("logicTags");

export const LOGIC_PAIRS_KEY: InjectionKey<LogicPair[]> = Symbol("logicPairs");

/**
 * Singleton state for the built-in logic picker modal. Provided by
 * `useEditorCore`, consumed by `useLogicTag.requestLogicTag()` (to open the modal)
 * and by `LogicTagPickerModal.vue` (to render and resolve).
 */
export const LOGIC_TAG_PICKER_KEY: InjectionKey<
  import("./composables/useLogicTagPicker").UseLogicTagPickerReturn
> = Symbol("logicPicker");

export const ON_REQUEST_LOGIC_TAG_KEY: InjectionKey<
  (() => Promise<LogicTag | LogicPair | null>) | null
> = Symbol("onRequestLogic");

export const ON_REQUEST_MEDIA_KEY: InjectionKey<OnRequestMedia | null> =
  Symbol("onRequestMedia");

/**
 * Per-editor display-only image URL resolver (`config.resolveImageUrl`),
 * wrapped with a per-src cache by `createImageUrlResolver`. `null` when the
 * host doesn't resolve — the canvas then displays canonical src values
 * verbatim. Consumed via `useResolvedImageSrc` in image-displaying blocks.
 */
export const IMAGE_URL_RESOLVER_KEY: InjectionKey<ImageUrlResolver | null> =
  Symbol("imageUrlResolver");

export const DISPLAY_CONDITIONS_KEY: InjectionKey<DisplayCondition[]> =
  Symbol("displayConditions");

export const ALLOW_CUSTOM_CONDITIONS_KEY: InjectionKey<boolean> = Symbol(
  "allowCustomConditions",
);

export const CAPABILITIES_KEY: InjectionKey<EditorCapabilities> =
  Symbol("capabilities");

export const KEYBOARD_REORDER_KEY: InjectionKey<UseKeyboardReorderReturn> =
  Symbol("keyboardReorder");

export const TEMPLATE_LINT_KEY: InjectionKey<
  import("./composables/useTemplateLint").UseTemplateLintReturn | null
> = Symbol("templateLint");

/**
 * The editor's effective DOM root — `Document` in light-DOM mode, `ShadowRoot`
 * when `shadowDom: true`. Composables that read `document.activeElement`,
 * popup mount targets, etc. should inject this and use the root-aware API
 * (both `Document` and `ShadowRoot` expose `activeElement` etc.).
 */
export const EDITOR_ROOT_KEY: InjectionKey<Document | ShadowRoot> =
  Symbol("editorRoot");

/**
 * Mount target for popovers, toolbars, and modal dialogs — never
 * `document.body`. Provided by `useEditorCore` as a ref bound
 * to a `<div class="tpl-popover-root" />` rendered at the top level of the
 * editor template. Teleports use `:to="popoverRoot"` so popups land inside
 * the editor's effective root — `document` in light-DOM mode, `ShadowRoot`
 * when `shadowDom: true` — instead of escaping the shadow boundary.
 *
 * Null until the editor's template mounts; consumers must guard with
 * `v-if="popoverRoot"` before passing to `<Teleport>`.
 */
export const POPOVER_ROOT_KEY: InjectionKey<Ref<HTMLElement | null>> =
  Symbol("popoverRoot");

/**
 * Reactive saved-blocks state, provided by `useSavedBlocksFeature` when a
 * `SavedBlocksProvider` is configured. Shared by OSS and Cloud — the storage
 * transport lives behind the provider, so this key is not cloud-specific.
 */
export const SAVED_BLOCKS_KEY: InjectionKey<UseSavedBlocksReturn> =
  Symbol("savedBlocks");

// ---------------------------------------------------------------------------
// Cloud-only keys (provided by createCloudRuntime, consumed by cloud components)
// ---------------------------------------------------------------------------

export const AUTH_MANAGER_KEY: InjectionKey<AuthManager> =
  Symbol("authManager");

export const AI_CONFIG_KEY: InjectionKey<UseAiConfigReturn> =
  Symbol("aiConfig");

// Comments are deliberately not injected: the panel takes `useCommentsFeature`'s
// return as a **prop** the way `TestEmailPanel` and `SavedBlocksPanels` do, and the
// per-block indicators read the comments entry on `CAPABILITIES_KEY`. Nothing
// injects the composable itself.

export const SCORING_KEY: InjectionKey<UseTemplateScoringReturn> =
  Symbol("scoring");

export const CLOUD_TRANSLATIONS_KEY: InjectionKey<CloudTranslations> =
  Symbol("cloudTranslations");

// ---------------------------------------------------------------------------
// Helper for required injections with explicit null default + throw
// ---------------------------------------------------------------------------

export function requireInject<T>(
  key: InjectionKey<T>,
  componentName: string,
): T {
  const value = inject(key, null) as T | null;
  if (value === null || value === undefined) {
    throw new Error(
      `${componentName} requires a provider for ${key.description ?? "unknown key"}. Ensure it renders inside the editor, below Editor.vue.`,
    );
  }
  return value;
}
