<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";

defineProps<{
  error: Error | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
}>();

const { t } = useI18n();

function getErrorMessage(error: Error): string {
  if (
    "isUnauthorized" in error &&
    (error as { isUnauthorized: boolean }).isUnauthorized
  ) {
    return t.error.authFailed;
  }
  if ("isNotFound" in error && (error as { isNotFound: boolean }).isNotFound) {
    return t.error.templateNotFound;
  }
  return t.error.defaultMessage;
}

function isNotFoundError(error: Error): boolean {
  return (
    "isNotFound" in error && !!(error as { isNotFound: boolean }).isNotFound
  );
}
</script>

<template>
  <div
    v-if="visible && error"
    role="alert"
    class="tpl-error tpl:absolute tpl:inset-0 tpl:z-overlay tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-6 tpl:px-8"
    style="background-color: var(--tpl-bg)"
  >
    <div
      class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full"
      style="background-color: var(--tpl-danger-light)"
    >
      <CircleAlert
        :size="32"
        :stroke-width="1.5"
        style="color: var(--tpl-danger)"
      />
    </div>
    <div
      class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-2 tpl:text-center"
    >
      <h2 class="tpl:text-lg tpl:font-semibold" style="color: var(--tpl-text)">
        {{ t.error.title }}
      </h2>
      <p class="tpl:max-w-md tpl:text-sm" style="color: var(--tpl-text-muted)">
        {{ getErrorMessage(error) }}
      </p>
    </div>
    <button
      v-if="!isNotFoundError(error)"
      class="tpl-btn tpl-btn-primary tpl:inline-flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90"
      style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
      @click="emit('retry')"
    >
      {{ t.error.retry }}
    </button>
  </div>
</template>
