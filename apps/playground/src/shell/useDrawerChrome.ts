import { ref, type Ref } from "vue";
import {
  clampDrawerHeight,
  readDrawerState,
  writeDrawerState,
} from "./drawer-chrome";

export interface DrawerChrome {
  open: Ref<boolean>;
  height: Ref<number>;
  activeTab: Ref<string>;
  setOpen: (open: boolean) => void;
  /** The live height during a resize — no storage write. */
  setHeight: (px: number) => void;
  /** The end of a resize gesture — one write, with the height it settled on. */
  commitHeight: (px: number) => void;
  setActiveTab: (id: string) => void;
}

/**
 * The drawer's chrome — what is open, how tall, which tab — held reactively
 * and persisted under its own key.
 *
 * Shaped like `useControlState`: the component holds refs and calls setters,
 * and every storage decision lives in `./drawer-chrome`.
 */
export function useDrawerChrome(): DrawerChrome {
  const initial = readDrawerState();
  const open = ref(initial.open);
  const height = ref(initial.height);
  const activeTab = ref(initial.activeTab);

  function persist(): void {
    writeDrawerState({
      open: open.value,
      height: height.value,
      activeTab: activeTab.value,
    });
  }

  function setOpen(next: boolean): void {
    open.value = next;
    persist();
  }

  /**
   * The live height during a resize. Storage is untouched: a pointer drag
   * emits this on every `pointermove`, and a `JSON.stringify` plus a
   * synchronous `setItem` per frame is a cost the gesture pays for nothing.
   * `commitHeight` is the write.
   */
  function setHeight(px: number): void {
    height.value = clampDrawerHeight(px);
  }

  function commitHeight(px: number): void {
    height.value = clampDrawerHeight(px);
    persist();
  }

  function setActiveTab(id: string): void {
    activeTab.value = id;
    persist();
  }

  return {
    open,
    height,
    activeTab,
    setOpen,
    setHeight,
    commitHeight,
    setActiveTab,
  };
}
