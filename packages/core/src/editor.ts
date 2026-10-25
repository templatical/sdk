import type {
  Block,
  BlockLock,
  BlockLocaleLayer,
  CustomBlockDefinition,
  Template,
  TemplateContent,
  TemplateDefaults,
  TemplatePatch,
  TemplateSaveTrigger,
  TemplateSettings,
  TemplatesProvider,
  UiTheme,
  ViewportSize,
} from "@templatical/types";
import {
  applyOperationsInPlace,
  defaultLocaleOf,
  deepEqual,
  isLocaleTag,
  localizeBlock,
  readPath,
  resolveLocale,
  safeClone,
  sourceHash,
  assertNoSlotInContent,
  assertNoWrapperInContent,
  createDefaultTemplateContent,
  SdkError,
} from "@templatical/types";
import {
  deriveLayer,
  deriveSettingsLayer,
  reconcileStructure,
} from "./localized-edit";
import {
  canEditStructure,
  isStructuralMutation,
  registerMutationGuard,
  type StructuralMutationContext,
} from "./mutation-guard";
import { notifyHandler } from "./error-reporting";
import {
  computed,
  reactive,
  readonly,
  ref,
  toRef,
  watch,
  type DeepReadonly,
  type Ref,
} from "@vue/reactivity";

export interface EditorState {
  /**
   * The template currently being edited, as the store last returned it — `null`
   * until `create()` or `load()` resolves, and always `null` without a
   * {@link TemplatesProvider}.
   *
   * Carries identity and name only for practical purposes: its `content` is the
   * store's copy from the last round-trip, whereas `state.content` is what the
   * user is editing.
   */
  template: Template | null;
  content: TemplateContent;
  activeLocale: string | null;
  selectedBlockId: string | null;
  viewport: ViewportSize;
  darkMode: boolean;
  previewMode: boolean;
  isDirty: boolean;
  /** True for the duration of a `save()` call. */
  isSaving: boolean;
  /** True while the latest `create()` or `load()` request is pending. */
  isLoading: boolean;
  uiTheme: UiTheme;
}

export interface UseEditorOptions {
  content: TemplateContent;
  localization?: { locales: string[] };
  onLocaleChange?: (locale: string) => void;
  onStructureChange?: () => void;
  defaultFontFamily?: string;
  templateDefaults?: TemplateDefaults;
  /**
   * Blocks other collaborators hold. A locked block can't be selected, and the
   * editor's own mutators leave it alone.
   */
  lockedBlocks?: Readonly<Ref<ReadonlyMap<string, unknown>>>;
  /** The language view for property edits and selection; absent or `null` is default. */
  lockLocale?: Readonly<Ref<string | null>>;
  /** This editor's session; its own locks never block local edits. */
  lockSessionId?: string;
  /**
   * Storage backend for the template's save/load lifecycle. Omit it and
   * `create()` / `load()` / `save()` reject — the editor keeps working as a
   * purely local editing surface.
   */
  templates?: TemplatesProvider;
  /**
   * Called with any error a provider call rejects with, before the rejection is
   * re-thrown to the caller.
   */
  onError?: (error: Error) => void;
}

export interface UseEditorReturn {
  state: DeepReadonly<EditorState>;
  /** Increments when create/load commits, including a reload of the same id. */
  loadVersion: Readonly<Ref<number>>;
  content: Ref<TemplateContent>;
  selectedBlock: Ref<Block | null>;
  activeLocale: Ref<string | null>;
  setActiveLocale: (locale: string | null) => void;
  addLocale: (locale: string) => void;
  removeLocale: (locale: string) => void;
  setBlockHidden: (blockId: string, hidden: boolean) => void;
  resetLocaleFields: (blockId: string, paths?: string[]) => void;
  keepTranslations: (blockId: string, paths: string[]) => void;
  setCustomBlockDefinitions: (defs: readonly CustomBlockDefinition[]) => void;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
  selectBlock: (blockId: string | null) => void;
  setViewport: (viewport: ViewportSize) => void;
  setDarkMode: (darkMode: boolean) => void;
  setPreviewMode: (previewMode: boolean) => void;
  setUiTheme: (theme: UiTheme) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  isBlockLocked: (blockId: string) => boolean;
  markDirty: () => void;
  findBlockLocation: (blockId: string) => {
    targetSectionId?: string;
    columnIndex?: number;
    index: number;
  } | null;
  /**
   * Rename the loaded template locally and mark the editor dirty. The new name
   * reaches the store on the next `save()`, in the same patch as the content —
   * a rename is an ordinary unsaved change, not a side channel.
   *
   * This method only stages it. The editor's inline rename field commits by
   * calling `setName()` and then saving immediately, because a rename reads as a
   * discrete action rather than an edit to be batched — so in the editor the
   * "next `save()`" is usually the one it triggers itself. A headless caller
   * decides its own moment.
   *
   * No-op when no template is loaded: there is nothing to name.
   */
  setName: (name: string) => void;
  /**
   * Persist the current content as a new template. `input.content`, when given,
   * replaces the editor's content first — so `create({ content })` both loads
   * and stores in one step.
   */
  create: (input?: {
    name?: string;
    content?: TemplateContent;
  }) => Promise<Template>;
  /** Fetch a template; an optional guard can discard a stale response. */
  load: (templateId: string, shouldApply?: () => boolean) => Promise<Template>;
  /**
   * Persist the loaded template's name + content as a patch.
   *
   * `trigger` is passed through to `TemplatesOptions.onSaved`. It defaults to
   * `"api"`, which is the honest answer for a direct call — the editor package
   * passes the value matching whichever affordance fired.
   */
  save: (trigger?: TemplateSaveTrigger) => Promise<Template>;
  /** Whether a template has been created or loaded. */
  hasTemplate: () => boolean;
}

export function useEditor(options: UseEditorOptions): UseEditorReturn {
  const seedContent =
    options.content ??
    createDefaultTemplateContent(
      options.defaultFontFamily,
      options.templateDefaults,
    );
  // Layout-only; authored content must not contain slot or wrapper.
  assertNoSlotInContent(seedContent);
  assertNoWrapperInContent(seedContent);

  const state = reactive<EditorState>({
    template: null,
    content: seedContent,
    activeLocale: null,
    selectedBlockId: null,
    viewport: "desktop",
    darkMode: false,
    previewMode: false,
    isDirty: false,
    isSaving: false,
    isLoading: false,
    uiTheme: "auto",
  });
  const activeLocale = toRef(state, "activeLocale");
  let definitions: readonly CustomBlockDefinition[] = [];

  function setActiveLocale(locale: string | null): void {
    const fallback = defaultLocaleOf(state.content);
    if (locale === fallback) locale = null;
    if (locale !== null && !state.content.settings.locales?.includes(locale)) {
      throw new SdkError(
        `This template has no "${locale}" version.`,
        undefined,
        "unknown_locale",
      );
    }
    if (activeLocale.value === locale) return;
    activeLocale.value = locale;
    notifyHandler(options.onError, () =>
      options.onLocaleChange?.(locale ?? fallback),
    );
  }

  // Also covers remote content replacement and snapshot history navigation.
  watch(
    () => state.content.settings.locales?.includes(activeLocale.value ?? ""),
    () => {
      if (
        activeLocale.value &&
        !state.content.settings.locales?.includes(activeLocale.value)
      )
        setActiveLocale(null);
    },
  );

  function canEditLocale(): boolean {
    return (
      activeLocale.value === null ||
      options.localization === undefined ||
      options.localization.locales.includes(activeLocale.value)
    );
  }

  function setCustomBlockDefinitions(
    defs: readonly CustomBlockDefinition[],
  ): void {
    definitions = defs;
  }

  function localeListDraft(
    method: "addLocale" | "removeLocale",
    locale: string,
  ): TemplateContent | null {
    if (!canEditLocale()) return null;
    if (
      method === "addLocale" &&
      (!isLocaleTag(locale) ||
        (options.localization &&
          !options.localization.locales.includes(locale)))
    ) {
      throw new SdkError(
        `Locale "${locale}" is not enabled.`,
        undefined,
        "unknown_locale",
      );
    }
    const draft = safeClone(state.content);
    applyOperationsInPlace(draft, [{ op: method, locale }]);
    return deepEqual(draft, state.content) ? null : draft;
  }

  function changeLocaleList(
    method: "addLocale" | "removeLocale",
    locale: string,
  ): void {
    const draft = localeListDraft(method, locale);
    if (!draft) return;
    state.content = draft;
    touch();
  }

  function addLocale(locale: string): void {
    changeLocaleList("addLocale", locale);
  }

  function removeLocale(locale: string): void {
    changeLocaleList("removeLocale", locale);
  }

  function writeLayer(block: Block, layer: BlockLocaleLayer): void {
    const locale = activeLocale.value!;
    if (Object.keys(layer).length) {
      block.l10n = { ...block.l10n, [locale]: layer };
    } else if (block.l10n) {
      delete block.l10n[locale];
      if (!Object.keys(block.l10n).length) delete block.l10n;
    }
  }

  type LayerMutation =
    "setBlockHidden" | "resetLocaleFields" | "keepTranslations";

  function prepareLayerEdit(
    method: LayerMutation,
    args: unknown[],
  ): { block: Block; layer: BlockLocaleLayer } | null {
    const [blockId, value] = args as [string, boolean | string[] | undefined];
    if (!activeLocale.value || !canEditLocale() || isBlockLocked(blockId))
      return null;
    const block = findBlockById(state.content.blocks, blockId);
    if (!block) return null;
    const previous = block.l10n?.[activeLocale.value];
    const layer = deriveLayer(
      block,
      localizeBlock(block, activeLocale.value, defaultLocaleOf(state.content)),
      previous ? safeClone(previous) : undefined,
      definitions,
    );
    if (method === "setBlockHidden") {
      if (value) layer.hidden = true;
      else delete layer.hidden;
    } else if (method === "resetLocaleFields") {
      if (!value) {
        delete layer.text;
        delete layer.set;
        delete layer.hidden;
      } else
        for (const path of value as string[]) {
          if (layer.text) delete layer.text[path];
          if (layer.set) delete layer.set[path];
        }
    } else
      for (const path of value as string[]) {
        const text = layer.text?.[path];
        if (text) text.source = sourceHash(String(readPath(block, path) ?? ""));
      }
    if (layer.text && !Object.keys(layer.text).length) delete layer.text;
    if (layer.set && !Object.keys(layer.set).length) delete layer.set;
    return deepEqual(previous ?? {}, layer) ? null : { block, layer };
  }

  function editLayer(method: LayerMutation, args: unknown[]): void {
    const prepared = prepareLayerEdit(method, args);
    if (!prepared) return;
    writeLayer(prepared.block, prepared.layer);
    touch();
  }

  function setBlockHidden(blockId: string, hidden: boolean): void {
    editLayer("setBlockHidden", [blockId, hidden]);
  }

  function resetLocaleFields(blockId: string, paths?: string[]): void {
    editLayer("resetLocaleFields", [blockId, paths]);
  }

  function keepTranslations(blockId: string, paths: string[]): void {
    editLayer("keepTranslations", [blockId, paths]);
  }

  const loadVersion = ref(0);
  let loadingRequest = 0;

  /**
   * Bumped by every content mutation. `save()` captures it before awaiting the
   * provider and only clears `isDirty` if it is unchanged afterwards, so an edit
   * made while a save is in flight is not reported as persisted — which would
   * also make autosave skip it, since that decides dirtiness at debounce time.
   */
  let revision = 0;

  function touch(): void {
    state.isDirty = true;
    revision++;
  }

  const content = computed({
    get: () => state.content,
    set: (value: TemplateContent) => {
      state.content = value;
      touch();
    },
  });

  const selectedBlock = computed(() => {
    if (!state.selectedBlockId) return null;
    return findBlockById(state.content.blocks, state.selectedBlockId);
  });

  function findBlockById(blocks: Block[], id: string): Block | null {
    for (const block of blocks) {
      if (block.id === id) return block;
      if (block.type === "section") {
        for (const column of block.children) {
          const found = findBlockById(column, id);
          if (found) return found;
        }
      }
    }
    return null;
  }

  function collectBlockIds(block: Block, ids: Set<string>): void {
    ids.add(block.id);
    if (block.type === "section") {
      for (const column of block.children) {
        for (const child of column) {
          collectBlockIds(child, ids);
        }
      }
    }
  }

  function findBlockParent(
    blocks: Block[],
    id: string,
    parent: {
      blocks: Block[];
      sectionId?: string;
      columnIndex?: number;
    } = { blocks },
  ): { blocks: Block[]; sectionId?: string; columnIndex?: number } | null {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.id === id) return parent;
      if (block.type === "section") {
        for (let colIdx = 0; colIdx < block.children.length; colIdx++) {
          const result = findBlockParent(block.children[colIdx], id, {
            blocks: block.children[colIdx],
            sectionId: block.id,
            columnIndex: colIdx,
          });
          if (result) return result;
        }
      }
    }
    return null;
  }

  function isBlockLocked(blockId: string, structure = false): boolean {
    const locale = activeLocale.value ?? options.lockLocale?.value ?? null;
    for (const [key, value] of options.lockedBlocks?.value ?? []) {
      const lock = value as Partial<BlockLock> | null;
      if (lock?.blockId === undefined) {
        if (key === blockId) return true;
        continue;
      }
      if (
        lock.blockId !== blockId ||
        lock.holder?.sessionId === options.lockSessionId
      )
        continue;
      if (
        structure ||
        locale === null ||
        lock.locale == null ||
        lock.locale === locale
      )
        return true;
    }
    return false;
  }

  function findBlockLocation(blockId: string): {
    targetSectionId?: string;
    columnIndex?: number;
    index: number;
  } | null {
    const parent = findBlockParent(state.content.blocks, blockId);
    if (!parent) return null;
    const index = parent.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return null;
    return {
      targetSectionId: parent.sectionId,
      columnIndex: parent.columnIndex,
      index,
    };
  }

  // TODO(collab): the lock checks in addBlock/moveBlock/removeBlock/updateBlock
  // are shallow — they only consider the directly-targeted block id. A section
  // can still be removed, moved, or have its `children` array rewritten while a
  // peer is editing one of its descendants, which silently disrupts that peer's
  // edit. Add a `hasLockedDescendant(blockId)` helper and gate section-level
  // operations on it (and on the parent of each affected child) so cascades
  // through the tree are also blocked.

  function setContent(newContent: TemplateContent, markDirty = true): void {
    assertNoSlotInContent(newContent);
    assertNoWrapperInContent(newContent);
    state.content = newContent;
    if (markDirty) {
      touch();
    }
  }

  function selectBlock(blockId: string | null): void {
    if (blockId && isBlockLocked(blockId)) {
      return;
    }
    state.selectedBlockId = blockId;
  }

  function setViewport(viewport: ViewportSize): void {
    state.viewport = viewport;
  }

  function setDarkMode(darkMode: boolean): void {
    state.darkMode = darkMode;
  }

  function setUiTheme(theme: UiTheme): void {
    state.uiTheme = theme;
  }

  function setPreviewMode(previewMode: boolean): void {
    state.previewMode = previewMode;
    if (previewMode) {
      state.selectedBlockId = null;
    }
  }

  function updateBlock(blockId: string, updates: Partial<Block>): void {
    if (!canEditLocale()) return;
    const block = findBlockById(state.content.blocks, blockId);
    if (!block) return;
    if ("l10n" in updates)
      throw new SdkError(
        "l10n is immutable in updateBlock.",
        undefined,
        "invalid_operation",
      );
    const locale = activeLocale.value;
    if (!locale) {
      if (isBlockLocked(blockId, "children" in updates || "columns" in updates))
        return;
      Object.assign(block, updates);
    } else {
      const view = localizeBlock(block, locale, defaultLocaleOf(state.content));
      const next = { ...view, ...updates } as Block;
      const base = safeClone(block);
      const structural = reconcileStructure(base, next, (id) =>
        findBlockById(state.content.blocks, id),
      );
      if (isBlockLocked(blockId, structural)) return;
      if (structural) options.onStructureChange?.();
      Object.assign(block, base);
      writeLayer(
        block,
        deriveLayer(block, next, block.l10n?.[locale], definitions),
      );
    }
    touch();
  }

  function updateSettings(updates: Partial<TemplateSettings>): void {
    if (!canEditLocale()) return;
    if ("locales" in updates || "l10n" in updates)
      throw new SdkError(
        "locales and l10n are immutable in updateSettings.",
        undefined,
        "invalid_operation",
      );
    if (
      "locale" in updates &&
      updates.locale !== defaultLocaleOf(state.content) &&
      state.content.settings.locales?.length
    ) {
      throw new SdkError(
        "The default locale can't change while language versions exist.",
        undefined,
        "invalid_operation",
      );
    }
    const locale = activeLocale.value;
    if (!locale)
      state.content.settings = { ...state.content.settings, ...updates };
    else {
      const settings = state.content.settings;
      const view = resolveLocale(state.content, locale).settings;
      const layer = deriveSettingsLayer(
        settings,
        { ...view, locale: settings.locale, ...updates },
        settings.l10n?.[locale],
      );
      if (Object.keys(layer).length)
        settings.l10n = { ...settings.l10n, [locale]: layer };
      else if (settings.l10n) {
        delete settings.l10n[locale];
        if (!Object.keys(settings.l10n).length) delete settings.l10n;
      }
    }
    touch();
  }

  const structuralContext: StructuralMutationContext = {
    canEdit: canEditLocale,
    content: () => state.content,
    findBlock: (id) => findBlockById(state.content.blocks, id),
    findBlockLocation,
    isBlockLocked,
  };

  function addBlock(
    block: Block,
    targetSectionId?: string,
    columnIndex = 0,
    index?: number,
  ): void {
    if (
      !canEditStructure(structuralContext, "addBlock", [
        block,
        targetSectionId,
        columnIndex,
        index,
      ])
    )
      return;
    if (targetSectionId) {
      const section = findBlockById(state.content.blocks, targetSectionId);
      if (section && section.type === "section") {
        section.children[columnIndex] = section.children[columnIndex] || [];
        const targetArray = section.children[columnIndex];
        if (index !== undefined && index < targetArray.length) {
          targetArray.splice(index, 0, block);
        } else {
          targetArray.push(block);
        }
      }
    } else {
      if (index !== undefined && index < state.content.blocks.length) {
        state.content.blocks.splice(index, 0, block);
      } else {
        state.content.blocks.push(block);
      }
    }
    if (activeLocale.value) options.onStructureChange?.();
    touch();
  }

  function removeBlock(blockId: string): void {
    if (!canEditStructure(structuralContext, "removeBlock", [blockId])) return;
    const parent = findBlockParent(state.content.blocks, blockId);
    if (parent) {
      const index = parent.blocks.findIndex((b) => b.id === blockId);
      if (index !== -1) {
        const [removed] = parent.blocks.splice(index, 1);
        if (state.selectedBlockId) {
          const removedIds = new Set<string>();
          collectBlockIds(removed, removedIds);
          if (removedIds.has(state.selectedBlockId)) {
            state.selectedBlockId = null;
          }
        }
        if (activeLocale.value) options.onStructureChange?.();
        touch();
      }
    }
  }

  function moveBlock(
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex = 0,
  ): void {
    if (
      !canEditStructure(structuralContext, "moveBlock", [
        blockId,
        newIndex,
        targetSectionId,
        columnIndex,
      ])
    )
      return;
    const parent = findBlockParent(state.content.blocks, blockId)!;
    const oldIndex = parent.blocks.findIndex((block) => block.id === blockId);
    let targetArray: Block[];
    if (targetSectionId) {
      const section = findBlockById(
        state.content.blocks,
        targetSectionId,
      ) as Extract<Block, { type: "section" }>;
      section.children[columnIndex] = section.children[columnIndex] || [];
      targetArray = section.children[columnIndex];
    } else {
      targetArray = state.content.blocks;
    }

    const [block] = parent.blocks.splice(oldIndex, 1);
    targetArray.splice(newIndex, 0, block);

    if (activeLocale.value) options.onStructureChange?.();
    touch();
  }

  function markDirty(): void {
    touch();
  }

  // -------------------------------------------------------------------------
  // Template lifecycle (over an optional TemplatesProvider)
  // -------------------------------------------------------------------------

  /**
   * A refused call throws rather than resolving, because a resolved promise
   * would read as "saved" to whoever awaited it.
   *
   * The message names the provider key the consumer set, not an internal
   * capability flag: neither `EditorCapabilities` nor its injection key is
   * exported, so neither a core nor an editor consumer can read one. Note the
   * editor hides its own save controls when `save` is withheld but has no
   * create affordance to hide at all, so `create()` is reachable by definition.
   */
  function refuse(action: string, reason: string): never {
    throw new SdkError(`[Templatical] Templates: ${action} ${reason}`);
  }

  /**
   * Run a consumer's event handler without letting it fail the operation.
   *
   * A handler that throws must not turn a completed write into a rejected one —
   * the UI would report a failure for something that landed.
   */
  function notify(run: () => void): void {
    notifyHandler(options.onError, run);
  }

  function requireProvider(action: string): TemplatesProvider {
    const { templates } = options;
    if (!templates) {
      refuse(
        action,
        "needs a templates provider. Pass one as `init({ templates })` to enable saving and loading.",
      );
    }
    return templates;
  }

  function setName(name: string): void {
    if (!state.template) return;
    state.template = { ...state.template, name };
    touch();
  }

  async function create(input?: {
    name?: string;
    content?: TemplateContent;
  }): Promise<Template> {
    const provider = requireProvider("create()");
    const { create: providerCreate } = provider;
    if (typeof providerCreate !== "function") {
      refuse(
        "create()",
        "is disabled by the provider — its `create` is `false`.",
      );
    }

    let created: Template;
    const request = ++loadingRequest;
    state.isLoading = true;
    try {
      if (input?.content) {
        state.content = input.content;
      }
      // Omit `name` entirely when unset rather than sending `undefined` — a
      // provider serialising the input to JSON would otherwise receive a key it
      // never asked for.
      const revisionAtRequest = revision;
      created = await providerCreate(
        input?.name !== undefined
          ? { name: input.name, content: state.content }
          : { content: state.content },
      );
      state.template = created;
      if (revision === revisionAtRequest) {
        state.isDirty = false;
      }
      loadVersion.value++;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      if (loadingRequest === request) state.isLoading = false;
    }
    // Release this request's loading flag before notifying the consumer. A
    // newer request, if any, retains ownership. Unreachable on failure.
    notify(() => provider.onCreated?.(created));
    return created;
  }

  async function load(
    templateId: string,
    shouldApply?: () => boolean,
  ): Promise<Template> {
    const provider = requireProvider("load()");

    let loaded: Template;
    const request = ++loadingRequest;
    state.isLoading = true;
    try {
      loaded = await provider.load(templateId);
      assertNoSlotInContent(loaded.content);
      assertNoWrapperInContent(loaded.content);
      if (shouldApply && !shouldApply()) return loaded;
      state.template = loaded;
      state.content = loaded.content;
      state.isDirty = false;
      loadVersion.value++;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      if (loadingRequest === request) state.isLoading = false;
    }
    // Release this request's loading flag before notifying the consumer. A
    // newer request, if any, retains ownership. Unreachable on failure.
    notify(() => provider.onLoaded?.(loaded));
    return loaded;
  }

  async function save(trigger: TemplateSaveTrigger = "api"): Promise<Template> {
    const provider = requireProvider("save()");
    const { save: providerSave } = provider;
    if (typeof providerSave !== "function") {
      refuse("save()", "is disabled by the provider — its `save` is `false`.");
    }
    const current = state.template;
    if (!current) {
      refuse(
        "save()",
        "has no template loaded. Call create() or load() first.",
      );
    }

    // The name rides the same patch as the content: a rename is an ordinary
    // unsaved change, so one round-trip persists both.
    const patch: TemplatePatch =
      current.name !== undefined
        ? { name: current.name, content: state.content }
        : { content: state.content };

    let saved: Template;
    state.isSaving = true;
    try {
      const revisionAtRequest = revision;
      saved = await providerSave(current.id, patch);
      // Adopt the response only while it still describes what is open. A
      // `load()` that landed mid-flight has already replaced the template, so
      // the response is stale.
      if (state.template?.id === current.id) {
        // The patch was built before the await, so a rename that landed during
        // it is absent from the response. Taking the response's name verbatim
        // reverts what the user typed — and because the next save reads the
        // name back off `state.template`, it would then persist the stale one,
        // losing the rename outright rather than merely on screen.
        const localName = state.template.name;
        state.template =
          localName !== current.name ? { ...saved, name: localName } : saved;
      }
      // Deliberately conditional. An edit landing while the request was in
      // flight is not persisted by it, and clearing the flag would both claim it
      // was and make autosave — which checks dirtiness at debounce time — skip
      // the follow-up save.
      if (revision === revisionAtRequest) {
        state.isDirty = false;
      }
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isSaving = false;
    }
    // Below the `finally` on purpose: `isSaving` is cleared there, and a handler
    // that navigates must observe a settled editor or the consumer's own dirty
    // guard blocks their navigation. Unreachable on failure — the catch rethrows.
    notify(() => provider.onSaved?.(saved, { trigger }));
    return saved;
  }

  function hasTemplate(): boolean {
    return state.template?.id !== undefined;
  }

  const editor: UseEditorReturn = {
    state: readonly(state),
    loadVersion: readonly(loadVersion),
    content,
    selectedBlock,
    activeLocale,
    setActiveLocale,
    addLocale,
    removeLocale,
    setBlockHidden,
    resetLocaleFields,
    keepTranslations,
    setCustomBlockDefinitions,
    isBlockLocked,
    setContent,
    selectBlock,
    setViewport,
    setDarkMode,
    setUiTheme,
    setPreviewMode,
    updateBlock,
    updateSettings,
    addBlock,
    removeBlock,
    moveBlock,
    markDirty,
    findBlockLocation,
    setName,
    create,
    load,
    save,
    hasTemplate,
  };
  registerMutationGuard(editor, (method, args) => {
    if (isStructuralMutation(method))
      return canEditStructure(structuralContext, method, args);
    if (!canEditLocale()) return false;
    if (method === "addLocale" || method === "removeLocale")
      return localeListDraft(method, args[0] as string) !== null;
    if (
      method === "setBlockHidden" ||
      method === "resetLocaleFields" ||
      method === "keepTranslations"
    )
      return prepareLayerEdit(method, args) !== null;
    return true;
  });
  return editor;
}
