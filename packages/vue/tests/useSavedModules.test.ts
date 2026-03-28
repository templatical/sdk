import { describe, expect, it } from 'vitest';
import { useVisualSavedModules } from '../src/cloud/composables/useSavedModules';
import type { UseSavedModulesReturn } from '@templatical/core/cloud';

function createMockHeadless(): UseSavedModulesReturn {
  return {} as UseSavedModulesReturn;
}

describe('useVisualSavedModules', () => {
  it('has initial state with showSaveDialog=false', () => {
    const result = useVisualSavedModules(createMockHeadless());
    expect(result.showSaveDialog.value).toBe(false);
  });

  it('has initial state with showBrowserModal=false', () => {
    const result = useVisualSavedModules(createMockHeadless());
    expect(result.showBrowserModal.value).toBe(false);
  });

  it('has initial state with preSelectedBlockId=null', () => {
    const result = useVisualSavedModules(createMockHeadless());
    expect(result.preSelectedBlockId.value).toBeNull();
  });

  it('openSaveDialog(blockId) sets preSelectedBlockId and showSaveDialog', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openSaveDialog('block-123');
    expect(result.preSelectedBlockId.value).toBe('block-123');
    expect(result.showSaveDialog.value).toBe(true);
  });

  it('openSaveDialog() without blockId sets preSelectedBlockId to null', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openSaveDialog();
    expect(result.preSelectedBlockId.value).toBeNull();
    expect(result.showSaveDialog.value).toBe(true);
  });

  it('closeSaveDialog resets both flags', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openSaveDialog('block-456');
    result.closeSaveDialog();
    expect(result.showSaveDialog.value).toBe(false);
    expect(result.preSelectedBlockId.value).toBeNull();
  });

  it('openBrowserModal sets showBrowserModal to true', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openBrowserModal();
    expect(result.showBrowserModal.value).toBe(true);
  });

  it('closeBrowserModal sets showBrowserModal to false', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openBrowserModal();
    result.closeBrowserModal();
    expect(result.showBrowserModal.value).toBe(false);
  });

  it('open/close cycle returns to initial state', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openSaveDialog('block-789');
    result.openBrowserModal();
    result.closeSaveDialog();
    result.closeBrowserModal();
    expect(result.showSaveDialog.value).toBe(false);
    expect(result.showBrowserModal.value).toBe(false);
    expect(result.preSelectedBlockId.value).toBeNull();
  });

  it('headless reference is passed through unchanged', () => {
    const headless = createMockHeadless();
    const result = useVisualSavedModules(headless);
    expect(result.headless).toBe(headless);
  });

  it('concurrent dialog states are independent (both can be open)', () => {
    const result = useVisualSavedModules(createMockHeadless());
    result.openSaveDialog('block-abc');
    result.openBrowserModal();
    expect(result.showSaveDialog.value).toBe(true);
    expect(result.showBrowserModal.value).toBe(true);

    result.closeSaveDialog();
    expect(result.showSaveDialog.value).toBe(false);
    expect(result.showBrowserModal.value).toBe(true);
  });
});
