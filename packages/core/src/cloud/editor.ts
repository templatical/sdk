import type {
  EditorState,
  Template,
  TemplateDefaults,
  UiTheme,
  ViewportSize,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
import { createDefaultTemplateContent } from "@templatical/types";
import { computed, reactive, readonly, type DeepReadonly, type Ref } from "vue";

export interface UseEditorOptions {
  authManager: AuthManager;
  defaultFontFamily?: string;
  templateDefaults?: TemplateDefaults;
  onError?: (error: Error) => void;
  lockedBlocks?: Ref<Map<string, unknown>>;
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
  savedBlockIds: Ref<Set<string>>;
  isBlockLocked: (blockId: string) => boolean;
  create: (content?: TemplateContent) => Promise<Template>;
  load: (templateId: string) => Promise<Template>;
  save: () => Promise<Template>;
  createSnapshot: () => Promise<void>;
  hasTemplate: () => boolean;
  markDirty: () => void;
}

export function useEditor(options: UseEditorOptions): UseEditorReturn {
  const api = new ApiClient(options.authManager);

  const state = reactive<EditorState>({
    template: null,
    content: createDefaultTemplateContent(
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

  const content = computed({
    get: () => state.content,
    set: (value: TemplateContent) => {
      state.content = value;
      state.isDirty = true;
    },
  });

  const selectedBlock = computed(() => {
    if (!state.selectedBlockId) return null;
    return findBlockById(state.content.blocks, state.selectedBlockId);
  });

  const savedBlockIds = computed<Set<string>>(() => {
    const ids = new Set<string>();
    const blocks = state.template?.content?.blocks;
    if (!blocks) {
      return ids;
    }
    for (const block of blocks) {
      ids.add(block.id);
      if (block.type === "section") {
        for (const column of block.children) {
          for (const child of column) {
            ids.add(child.id);
          }
        }
      }
    }
    return ids;
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

  function setContent(newContent: TemplateContent, markDirty = true): void {
    state.content = newContent;
    if (markDirty) {
      state.isDirty = true;
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
      state.isDirty = true;
    }
  }

  function updateSettings(updates: Partial<TemplateSettings>): void {
    state.content.settings = { ...state.content.settings, ...updates };
    state.isDirty = true;
  }

  function addBlock(
    block: Block,
    targetSectionId?: string,
    columnIndex = 0,
    index?: number,
  ): void {
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
    state.isDirty = true;
  }

  function removeBlock(blockId: string): void {
    if (isBlockLocked(blockId)) {
      return;
    }
    const parent = findBlockParent(state.content.blocks, blockId);
    if (parent) {
      const index = parent.blocks.findIndex((b) => b.id === blockId);
      if (index !== -1) {
        parent.blocks.splice(index, 1);
        if (state.selectedBlockId === blockId) {
          state.selectedBlockId = null;
        }
        state.isDirty = true;
      }
    }
  }

  function moveBlock(
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex = 0,
  ): void {
    const parent = findBlockParent(state.content.blocks, blockId);
    if (!parent) return;

    const oldIndex = parent.blocks.findIndex((b) => b.id === blockId);
    if (oldIndex === -1) return;

    const [block] = parent.blocks.splice(oldIndex, 1);

    if (targetSectionId) {
      const section = findBlockById(state.content.blocks, targetSectionId);
      if (section && section.type === "section") {
        section.children[columnIndex] = section.children[columnIndex] || [];
        section.children[columnIndex].splice(newIndex, 0, block);
      }
    } else {
      state.content.blocks.splice(newIndex, 0, block);
    }

    state.isDirty = true;
  }

  async function create(content?: TemplateContent): Promise<Template> {
    state.isLoading = true;
    try {
      if (content) {
        state.content = content;
      }
      const template = await api.createTemplate(state.content);
      state.template = template;
      state.isDirty = false;
      return template;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isLoading = false;
    }
  }

  async function load(templateId: string): Promise<Template> {
    state.isLoading = true;
    try {
      const template = await api.getTemplate(templateId);
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
    if (!state.template?.id) {
      throw new SdkError(
        "No template loaded. Call create() or load() before saving.",
      );
    }

    state.isSaving = true;
    try {
      const template = await api.updateTemplate(
        state.template.id,
        state.content,
      );
      state.template = template;
      state.isDirty = false;
      return template;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      state.isSaving = false;
    }
  }

  async function createSnapshot(): Promise<void> {
    if (!state.template?.id) {
      return;
    }

    try {
      await api.createSnapshot(state.template.id, state.content);
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  function hasTemplate(): boolean {
    return state.template?.id !== undefined;
  }

  function markDirty(): void {
    state.isDirty = true;
  }

  return {
    state: readonly(state),
    content,
    selectedBlock,
    savedBlockIds,
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
    create,
    load,
    save,
    createSnapshot,
    hasTemplate,
    markDirty,
  };
}
