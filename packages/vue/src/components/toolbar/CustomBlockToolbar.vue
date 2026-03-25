<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useDataSourceFetch } from "@templatical/core";
import type {
  CustomBlock,
  CustomBlockDefinition,
  CustomBlockField,
} from "@templatical/types";
import { CircleAlert, RefreshCw } from "lucide-vue-next";
import { computed, inject } from "vue";
import { resolveFieldComponent } from "./fields";

const props = defineProps<{
  block: CustomBlock;
}>();

const emit = defineEmits<{
  (e: "updateFieldValues", values: Record<string, unknown>): void;
  (e: "updateDataSourceFetched", fetched: boolean): void;
}>();

const { t } = useI18n();

const customBlockDefinitions = inject<CustomBlockDefinition[]>(
  "customBlockDefinitions",
  [],
);

const definition = computed(() =>
  customBlockDefinitions.find((d) => d.type === props.block.customType),
);

const blockRef = computed(() => props.block);

const {
  isFetching,
  fetchError,
  fetch: fetchData,
  hasDataSource,
  needsFetch,
} = useDataSourceFetch({
  definition,
  block: blockRef,
  onUpdate: (fieldValues, fetched) => {
    emit("updateFieldValues", fieldValues);
    emit("updateDataSourceFetched", fetched);
  },
});

function isFieldReadOnly(field: CustomBlockField): boolean {
  return (
    field.readOnly === true &&
    hasDataSource.value &&
    !!props.block.dataSourceFetched
  );
}

function updateField(key: string, value: unknown): void {
  emit("updateFieldValues", {
    ...props.block.fieldValues,
    [key]: value,
  });
}
</script>

<template>
  <div v-if="!definition" class="tpl:p-4">
    <p
      class="tpl:m-0 tpl:text-center tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
    >
      {{ t.customBlocks.toolbar.noDefinition }}
    </p>
  </div>

  <div v-else>
    <p
      v-if="definition.description"
      class="tpl:m-0 tpl:mb-3 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
    >
      {{ definition.description }}
    </p>

    <div v-if="hasDataSource" class="tpl:mb-4">
      <!-- Before fetch: prominent button -->
      <button
        v-if="needsFetch && !isFetching"
        type="button"
        class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded-md tpl:px-3 tpl:py-2.5 tpl:text-sm tpl:font-medium tpl:text-white tpl:transition-all tpl:duration-150"
        style="background-color: var(--tpl-primary)"
        @click="fetchData"
      >
        {{
          definition?.dataSource?.label || t.customBlocks.dataSource.fetchButton
        }}
      </button>

      <!-- Loading / Change button -->
      <div v-else class="tpl:flex tpl:h-[32px] tpl:items-center">
        <div
          v-if="isFetching"
          class="tpl:w-full tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.customBlocks.dataSource.fetching }}
        </div>
        <button
          v-else
          type="button"
          class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]"
          @click="fetchData"
        >
          <RefreshCw :size="12" />
          {{ t.customBlocks.dataSource.changeButton }}
        </button>
      </div>

      <p
        v-if="fetchError"
        class="tpl:m-0 tpl:mt-2 tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-danger)]"
      >
        <CircleAlert :size="14" class="tpl:shrink-0" />
        {{ t.customBlocks.dataSource.fetchError }}
      </p>
    </div>

    <template v-for="field in definition.fields" :key="field.key">
      <component
        :is="resolveFieldComponent(field.type)"
        :field="field"
        :model-value="block.fieldValues[field.key]"
        :read-only="isFieldReadOnly(field)"
        @update:model-value="updateField(field.key, $event)"
      />
    </template>
  </div>
</template>
