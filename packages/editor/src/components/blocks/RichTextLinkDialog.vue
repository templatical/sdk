<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { X } from "@lucide/vue";
import { inject } from "vue";
import { THEME_STYLES_KEY, UI_THEME_KEY } from "../../keys";

defineProps<{
  visible: boolean;
  isEditingLink: boolean;
}>();

const linkUrl = defineModel<string>("linkUrl", { required: true });
const dialogRef = defineModel<HTMLElement | null>("dialogRef", {
  required: true,
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "insert"): void;
  (e: "remove"): void;
  (e: "keydown", event: KeyboardEvent): void;
}>();

const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);

const { t } = useI18n();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      :data-tpl-theme="tplUiTheme"
      class="tpl tpl-link-dialog tpl:fixed tpl:inset-0 tpl:z-modal tpl:flex tpl:items-center tpl:justify-center"
      :style="themeStyles"
      @click.self="emit('close')"
    >
      <div
        :ref="(el) => (dialogRef = el as HTMLElement | null)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-link-dialog-title"
        class="tpl:w-[400px] tpl:overflow-hidden tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:shadow-lg"
      >
        <div
          class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-5 tpl:py-4"
        >
          <h4
            id="tpl-link-dialog-title"
            class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
          >
            {{
              isEditingLink ? t.linkDialog.editLink : t.linkDialog.insertLink
            }}
          </h4>
          <button
            type="button"
            :aria-label="t.linkDialog.cancel"
            class="tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-muted)] tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
            @click="emit('close')"
          >
            <X :size="16" :stroke-width="2" />
          </button>
        </div>
        <div class="tpl:p-5">
          <div class="tpl:mb-4 tpl:last:mb-0">
            <label
              for="tpl-link-dialog-url"
              class="tpl:mb-1.5 tpl:block tpl:text-xs tpl:font-medium tpl:tracking-wide tpl:text-[var(--tpl-text-muted)] tpl:uppercase"
              >{{ t.linkDialog.urlLabel }}</label
            >
            <input
              id="tpl-link-dialog-url"
              v-model="linkUrl"
              type="url"
              class="tpl:w-full tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2.5 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
              :placeholder="t.linkDialog.urlPlaceholder"
              autofocus
              @keydown="emit('keydown', $event)"
            />
          </div>
        </div>
        <div
          class="tpl:flex tpl:items-center tpl:justify-between tpl:border-t tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:px-5 tpl:py-4"
        >
          <button
            v-if="isEditingLink"
            type="button"
            class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-danger)] tpl:bg-transparent tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:text-[var(--tpl-danger)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-danger-light)]"
            @click="emit('remove')"
          >
            {{ t.linkDialog.removeLink }}
          </button>
          <div class="tpl:ml-auto tpl:flex tpl:gap-2">
            <button
              type="button"
              class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-transparent tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
              @click="emit('close')"
            >
              {{ t.linkDialog.cancel }}
            </button>
            <button
              type="button"
              class="tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:rounded-md tpl:border-none tpl:bg-[var(--tpl-primary)] tpl:px-4 tpl:py-2 tpl:text-[13px] tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-primary-hover)] tpl:text-[var(--tpl-bg)]"
              @click="emit('insert')"
            >
              {{
                isEditingLink
                  ? t.linkDialog.updateLink
                  : t.linkDialog.insertLink
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
