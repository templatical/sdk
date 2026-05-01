<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { useCloudI18nStrict } from "../../composables/useCloudI18n";

defineProps<{
  error: Error | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
}>();

const { t: cloudT } = useCloudI18nStrict();

function getErrorMessage(error: Error): string {
  if (
    "isUnauthorized" in error &&
    (error as { isUnauthorized: boolean }).isUnauthorized
  ) {
    return cloudT.error.authFailed;
  }
  if ("isNotFound" in error && (error as { isNotFound: boolean }).isNotFound) {
    return cloudT.error.templateNotFound;
  }
  return cloudT.error.defaultMessage;
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
    class="tpl-error tpl:absolute tpl:inset-0 tpl:z-overlay tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-6 tpl:px-8 tpl:bg-[var(--tpl-bg)]"
  >
    <div
      class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-[var(--tpl-danger-light)]"
    >
      <CircleAlert
        :size="32"
        :stroke-width="1.5"
        class="tpl:text-[var(--tpl-danger)]"
      />
    </div>
    <div
      class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-2 tpl:text-center"
    >
      <h2 class="tpl:text-lg tpl:font-semibold tpl:text-[var(--tpl-text)]">
        {{ cloudT.error.title }}
      </h2>
      <p class="tpl:max-w-md tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
        {{ getErrorMessage(error) }}
      </p>
    </div>
    <button
      v-if="!isNotFoundError(error)"
      class="tpl-btn tpl-btn-primary tpl:inline-flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
      @click="emit('retry')"
    >
      {{ cloudT.error.retry }}
    </button>
  </div>
</template>
