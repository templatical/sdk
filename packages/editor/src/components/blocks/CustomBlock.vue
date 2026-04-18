<script setup lang="ts">
import CustomBlockIcon from "../CustomBlockIcon.vue";
import LoadingTrack from "../LoadingTrack.vue";
import { useI18n } from "../../composables";
import { useDataSourceFetch } from "@templatical/core";
import type {
  CustomBlock as CustomBlockType,
  ViewportSize,
} from "@templatical/types";
import { useDebounceFn } from "@vueuse/core";
import { TriangleAlert, Puzzle } from "@lucide/vue";
import { computed, inject, onMounted, ref, watch } from "vue";
import { BLOCK_REGISTRY_KEY } from "../../keys";

const props = defineProps<{
  block: CustomBlockType;
  viewport: ViewportSize;
}>();

const emit = defineEmits<{
  (
    e: "fetchData",
    payload: {
      fieldValues: Record<string, unknown>;
      dataSourceFetched: boolean;
    },
  ): void;
}>();

const { t } = useI18n();

const blockRegistry = inject(BLOCK_REGISTRY_KEY, null);

const renderedHtml = ref("");
const hasError = ref(false);

const definition = computed(() =>
  blockRegistry?.getDefinition(props.block.customType),
);

const hasDefinition = computed(() => !!definition.value);

const blockRef = computed(() => props.block);

const {
  isFetching,
  fetch: fetchData,
  needsFetch,
  hasDataSource,
} = useDataSourceFetch({
  definition,
  block: blockRef,
  onUpdate: (fieldValues, fetched) => {
    emit("fetchData", { fieldValues, dataSourceFetched: fetched });
  },
});

async function renderBlock(): Promise<void> {
  if (!blockRegistry) {
    return;
  }

  hasError.value = false;

  try {
    const html = await blockRegistry.renderCustomBlock(props.block);
    if (html.includes("Template render error:")) {
      hasError.value = true;
    }
    renderedHtml.value = html;
  } catch {
    hasError.value = true;
    renderedHtml.value = "";
  }
}

const debouncedRender = useDebounceFn(renderBlock, 150);

onMounted(() => {
  renderBlock();
});

watch(
  () => props.block.fieldValues,
  () => {
    debouncedRender();
  },
  { deep: true },
);
</script>

<template>
  <div class="tpl:w-full">
    <div
      v-if="!hasDefinition"
      class="tpl:flex tpl:min-h-[80px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:border-[var(--tpl-warning)] tpl:bg-[var(--tpl-warning-light)]"
    >
      <Puzzle :size="24" class="tpl:text-[var(--tpl-warning)]" />
      <span class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
        {{ t.customBlocks.definitionNotFound }}
      </span>
    </div>

    <div
      v-else-if="hasError"
      class="tpl:flex tpl:min-h-[80px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:border-[var(--tpl-danger)] tpl:bg-[var(--tpl-danger-light)]"
    >
      <TriangleAlert :size="24" class="tpl:text-[var(--tpl-danger)]" />
      <span class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
        {{ t.customBlocks.renderError }}
      </span>
    </div>

    <div v-else class="tpl:relative">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="renderedHtml" />

      <!-- Data source CTA overlay -->
      <div
        v-if="hasDataSource && needsFetch"
        class="tpl:absolute tpl:inset-0 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:rounded tpl:backdrop-blur-[2px]"
        style="
          background-color: color-mix(in srgb, var(--tpl-bg) 80%, transparent);
        "
      >
        <button
          v-if="!isFetching"
          type="button"
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:shadow-sm tpl:transition-all tpl:duration-150 hover:tpl:border-[var(--tpl-primary)] hover:tpl:shadow-md tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary-hover)]"
          @click.stop="fetchData"
        >
          <CustomBlockIcon
            v-if="definition?.icon"
            :icon="definition.icon"
            :size="16"
          />
          {{
            definition?.dataSource?.label ||
            t.customBlocks.dataSource.fetchButton
          }}
        </button>

        <LoadingTrack v-else class="tpl:w-48" />
      </div>
    </div>
  </div>
</template>
