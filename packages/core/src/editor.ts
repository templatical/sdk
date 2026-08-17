import type {
  Block,
  ColumnLayout,
  Template,
  TemplateContent,
  TemplateDefaults,
  TemplatePatch,
  TemplateSettings,
  TemplatesProvider,
  UiTheme,
  ViewportSize,
} from "@templatical/types";
import { createDefaultTemplateContent, SdkError } from "@templatical/types";

function getColumnCount(layout: ColumnLayout): number {
  if (layout === "1") return 1;
  if (layout === "3") return 3;
  return 2;
}
import {
  computed,
  reactive,
  readonly,
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
  selectedBlockId: string | null;
  viewport: ViewportSize;
  darkMode: boolean;
  previewMode: boolean;
  isDirty: boolean;
  /** True for the duration of a `save()` call. */
  isSaving: boolean;
  /** True for the duration of a `create()` or `load()` call. */
  isLoading: boolean;
  uiTheme: UiTheme;
}

export interface UseEditorOptions {
  content: TemplateContent;
  defaultFontFamily?: string;
  templateDefaults?: TemplateDefaults;
  lockedBlocks?: Ref<Map<string, unknown>>;
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
  content: Ref<TemplateContent>;
  selectedBlock: Ref<Block | null>;
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
  /** Fetch a template and make it the editor's content. */
  load: (templateId: string) => Promise<Template>;
  /** Persist the loaded template's name + content as a patch. */
  save: () => Promise<Template>;
  /** Whether a template has been created or loaded. */
  hasTemplate: () => boolean;
}

export function useEditor(options: UseEditorOptions): UseEditorReturn {
  const state = reactive<EditorState>({
    template: null,
    content:
      options.content ??
      createDefaultTemplateContent(
        options.defaultFontFamily,
        options.templateDefaults,
      ),
    selectedBlockId: null,
    viewport: "desktop",
    darkMode: false,
    previewMode: false,
    isDirty: false,
    isSaving: false,
    isLoading: false,
    uiTheme: "auto",
  });

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

  function isBlockLocked(blockId: string): boolean {
    return options.lockedBlocks?.value.has(blockId) ?? false;
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
    if (isBlockLocked(blockId)) {
      return;
    }
    const block = findBlockById(state.content.blocks, blockId);
    if (block) {
      Object.assign(block, updates);
      touch();
    }
  }

  function updateSettings(updates: Partial<TemplateSettings>): void {
    state.content.settings = { ...state.content.settings, ...updates };
    touch();
  }

  function addBlock(
    block: Block,
    targetSectionId?: string,
    columnIndex = 0,
    index?: number,
  ): void {
    // Sections cannot be nested inside a column — MJML forbids `mj-section`
    // inside `mj-column`, so the renderer drops them on export (issue #292).
    // Reject the nest up front rather than lose the content silently later.
    if (targetSectionId && block.type === "section") {
      return;
    }
    if (targetSectionId) {
      if (isBlockLocked(targetSectionId)) {
        return;
      }
      const section = findBlockById(state.content.blocks, targetSectionId);
      if (section && section.type === "section") {
        if (columnIndex < 0 || columnIndex >= getColumnCount(section.columns)) {
          return;
        }
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
    touch();
  }

  function removeBlock(blockId: string): void {
    if (isBlockLocked(blockId)) {
      return;
    }
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
    if (isBlockLocked(blockId)) {
      return;
    }
    if (targetSectionId && isBlockLocked(targetSectionId)) {
      return;
    }

    const parent = findBlockParent(state.content.blocks, blockId);
    if (!parent) return;

    const oldIndex = parent.blocks.findIndex((b) => b.id === blockId);
    if (oldIndex === -1) return;

    // Sections cannot be nested inside a column (issue #292) — refuse to move
    // a section into a section column; MJML would drop it on export.
    if (targetSectionId && parent.blocks[oldIndex].type === "section") {
      return;
    }

    // Resolve target before mutating the source — otherwise an invalid
    // targetSectionId leaves the block spliced-out and unrecoverable.
    let targetArray: Block[];
    if (targetSectionId) {
      const section = findBlockById(state.content.blocks, targetSectionId);
      if (!section || section.type !== "section") return;
      if (columnIndex < 0 || columnIndex >= getColumnCount(section.columns)) {
        return;
      }
      section.children[columnIndex] = section.children[columnIndex] || [];
      targetArray = section.children[columnIndex];
    } else {
      targetArray = state.content.blocks;
    }

    const [block] = parent.blocks.splice(oldIndex, 1);
    targetArray.splice(newIndex, 0, block);

    touch();
  }

  function markDirty(): void {
    touch();
  }

  // -------------------------------------------------------------------------
  // Template lifecycle (over an optional TemplatesProvider)
  // -------------------------------------------------------------------------

  /**
   * A refused call throws rather than resolving: the editor's own UI hides
   * whatever it cannot do, so reaching one of these means a programmatic caller
   * went around the capability — and a resolved promise would read as "saved".
   */
  function refuse(action: string, reason: string): never {
    throw new SdkError(`[Templatical] Templates: ${action} ${reason}`);
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
        "is disabled by the provider. Check `capabilities.templates.canCreate` before calling.",
      );
    }

    state.isLoading = true;
    try {
      if (input?.content) {
        state.content = input.content;
      }
      // Omit `name` entirely when unset rather than sending `undefined` — a
      // provider serialising the input to JSON would otherwise receive a key it
      // never asked for.
      const revisionAtRequest = revision;
      const template = await providerCreate(
        input?.name !== undefined
          ? { name: input.name, content: state.content }
          : { content: state.content },
      );
      state.template = template;
      if (revision === revisionAtRequest) {
        state.isDirty = false;
      }
      return template;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isLoading = false;
    }
  }

  async function load(templateId: string): Promise<Template> {
    const provider = requireProvider("load()");

    state.isLoading = true;
    try {
      const template = await provider.load(templateId);
      state.template = template;
      state.content = template.content;
      state.isDirty = false;
      return template;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isLoading = false;
    }
  }

  async function save(): Promise<Template> {
    const provider = requireProvider("save()");
    const { save: providerSave } = provider;
    if (typeof providerSave !== "function") {
      refuse(
        "save()",
        "is disabled by the provider. Check `capabilities.templates.canSave` before calling.",
      );
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

    state.isSaving = true;
    try {
      const revisionAtRequest = revision;
      const template = await providerSave(current.id, patch);
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
          localName !== current.name
            ? { ...template, name: localName }
            : template;
      }
      // Deliberately conditional. An edit landing while the request was in
      // flight is not persisted by it, and clearing the flag would both claim it
      // was and make autosave — which checks dirtiness at debounce time — skip
      // the follow-up save.
      if (revision === revisionAtRequest) {
        state.isDirty = false;
      }
      return template;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isSaving = false;
    }
  }

  function hasTemplate(): boolean {
    return state.template?.id !== undefined;
  }

  return {
    state: readonly(state),
    content,
    selectedBlock,
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
}
