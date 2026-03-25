import type { CustomBlock, CustomBlockDefinition } from "@templatical/types";
import type { ComputedRef, Ref } from "@vue/reactivity";
import { computed, ref } from "@vue/reactivity";

export function useDataSourceFetch(options: {
  definition: ComputedRef<CustomBlockDefinition | undefined>;
  block: ComputedRef<CustomBlock>;
  onUpdate: (fieldValues: Record<string, unknown>, fetched: boolean) => void;
}): {
  isFetching: Ref<boolean>;
  fetchError: Ref<boolean>;
  fetch: () => Promise<void>;
  hasDataSource: ComputedRef<boolean>;
  needsFetch: ComputedRef<boolean>;
} {
  const isFetching = ref(false);
  const fetchError = ref(false);

  const hasDataSource = computed(() => !!options.definition.value?.dataSource);

  const needsFetch = computed(
    () => hasDataSource.value && !options.block.value.dataSourceFetched,
  );

  async function fetch(): Promise<void> {
    const def = options.definition.value;
    if (!def?.dataSource) {
      return;
    }

    isFetching.value = true;
    fetchError.value = false;

    try {
      const result = await def.dataSource.onFetch({
        fieldValues: { ...options.block.value.fieldValues },
        blockId: options.block.value.id,
      });

      if (result === null || result === undefined) {
        return;
      }

      const merged = { ...options.block.value.fieldValues };
      for (const key of Object.keys(merged)) {
        if (key in result) {
          merged[key] = result[key];
        }
      }

      options.onUpdate(merged, true);
    } catch (error) {
      console.warn("[Templatical] Data source fetch error:", error);
      fetchError.value = true;
    } finally {
      isFetching.value = false;
    }
  }

  return {
    isFetching,
    fetchError,
    fetch,
    hasDataSource,
    needsFetch,
  };
}
