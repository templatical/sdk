import { nextTick, ref, watch, type Ref } from "vue";
import { useScrollLock } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

export function useHostModal(isOpen: Ref<boolean>) {
  const target = ref<HTMLElement | null>(null);
  const { activate, deactivate } = useFocusTrap(target, {
    allowOutsideClick: true,
    escapeDeactivates: true,
    onDeactivate() {
      isOpen.value = false;
    },
  });
  const bodyScrollLocked = useScrollLock(document.body);

  watch(isOpen, async (open) => {
    bodyScrollLocked.value = open;
    if (open) {
      await nextTick();
      activate();
    } else {
      deactivate();
    }
  });

  return target;
}
