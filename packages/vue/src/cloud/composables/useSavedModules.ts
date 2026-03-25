import type { UseSavedModulesReturn } from "@templatical/core/cloud";
import { ref } from "vue";

export interface UseVisualSavedModulesReturn {
  headless: UseSavedModulesReturn;
  showSaveDialog: ReturnType<typeof ref<boolean>>;
  preSelectedBlockId: ReturnType<typeof ref<string | null>>;
  openSaveDialog: (blockId?: string) => void;
  closeSaveDialog: () => void;
  showBrowserModal: ReturnType<typeof ref<boolean>>;
  openBrowserModal: () => void;
  closeBrowserModal: () => void;
}

export function useVisualSavedModules(
  headless: UseSavedModulesReturn,
): UseVisualSavedModulesReturn {
  const showSaveDialog = ref(false);
  const preSelectedBlockId = ref<string | null>(null);
  const showBrowserModal = ref(false);

  function openSaveDialog(blockId?: string): void {
    preSelectedBlockId.value = blockId ?? null;
    showSaveDialog.value = true;
  }

  function closeSaveDialog(): void {
    showSaveDialog.value = false;
    preSelectedBlockId.value = null;
  }

  function openBrowserModal(): void {
    showBrowserModal.value = true;
  }

  function closeBrowserModal(): void {
    showBrowserModal.value = false;
  }

  return {
    headless,
    showSaveDialog,
    preSelectedBlockId,
    openSaveDialog,
    closeSaveDialog,
    showBrowserModal,
    openBrowserModal,
    closeBrowserModal,
  };
}
