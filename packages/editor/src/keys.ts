import { inject, type InjectionKey, type ComputedRef, type Ref } from "vue";
import type {
  UseHistoryReturn,
  UseBlockActionsReturn,
  UseConditionPreviewReturn,
} from "@templatical/core";
import type {
  BlockDefaults,
  CustomBlockDefinition,
  DisplayCondition,
  MergeTag,
  SyntaxPreset,
} from "@templatical/types";
import type { Translations, CloudTranslations } from "./i18n";
import type {
  AuthManager,
  UseAiConfigReturn,
  UseCommentsReturn,
  UseSavedModulesReturn,
  UseTemplateScoringReturn,
} from "@templatical/core/cloud";
import type { BaseEditorReturn } from "./composables/useEditorCore";
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

export const MERGE_TAGS_KEY: InjectionKey<MergeTag[]> = Symbol("mergeTags");

export const MERGE_TAG_SYNTAX_KEY: InjectionKey<SyntaxPreset> =
  Symbol("mergeTagSyntax");

export const ON_REQUEST_MERGE_TAG_KEY: InjectionKey<
  (() => Promise<MergeTag | null>) | null
> = Symbol("onRequestMergeTag");

export const MERGE_TAG_AUTOCOMPLETE_KEY: InjectionKey<boolean> = Symbol(
  "mergeTagAutocomplete",
);

export const ON_REQUEST_MEDIA_KEY: InjectionKey<OnRequestMedia | null> =
  Symbol("onRequestMedia");

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
 * Mount target for popovers, toolbars, and modal dialogs that previously
 * teleported to `document.body`. Provided by `useEditorCore` as a ref bound
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

// ---------------------------------------------------------------------------
// Cloud-only keys (provided by CloudEditor, consumed by cloud components)
// ---------------------------------------------------------------------------

export const AUTH_MANAGER_KEY: InjectionKey<AuthManager> =
  Symbol("authManager");

export const AI_CONFIG_KEY: InjectionKey<UseAiConfigReturn> =
  Symbol("aiConfig");

export const COMMENTS_KEY: InjectionKey<UseCommentsReturn> = Symbol("comments");

export const SAVED_MODULES_HEADLESS_KEY: InjectionKey<UseSavedModulesReturn> =
  Symbol("savedModulesHeadless");

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
      `${componentName} requires a provider for ${key.description ?? "unknown key"}. Ensure it is a descendant of Editor or CloudEditor.`,
    );
  }
  return value;
}
