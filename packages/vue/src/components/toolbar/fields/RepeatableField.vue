<script setup lang="ts">
import { useI18n } from '../../../composables/useI18n';
import type { CustomBlockRepeatableField } from '@templatical/types';
import { labelClass } from '../../../constants/styleConstants';
import { Lock, Plus, Trash2 } from 'lucide-vue-next';
import { computed } from 'vue';
import { resolveFieldComponent } from './index';

const props = defineProps<{
    field: CustomBlockRepeatableField;
    modelValue: Record<string, unknown>[];
    readOnly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>[]): void;
}>();

const { t } = useI18n();

const items = computed(() => props.modelValue || []);

const canAdd = computed(
    () => !props.field.maxItems || items.value.length < props.field.maxItems,
);

const canRemove = computed(
    () => !props.field.minItems || items.value.length > props.field.minItems,
);

function addItem(): void {
    if (!canAdd.value || props.readOnly) {
        return;
    }

    const newItem: Record<string, unknown> = {};
    for (const subField of props.field.fields) {
        newItem[subField.key] = subField.default ?? '';
    }

    emit('update:modelValue', [...items.value, newItem]);
}

function removeItem(index: number): void {
    if (!canRemove.value || props.readOnly) {
        return;
    }

    const updated = [...items.value];
    updated.splice(index, 1);
    emit('update:modelValue', updated);
}

function updateItemField(index: number, key: string, value: unknown): void {
    const updated = items.value.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
    );
    emit('update:modelValue', updated);
}
</script>

<template>
    <div class="tpl:mb-3.5">
        <label :class="labelClass">
            {{ field.label }}
            <Lock
                v-if="readOnly"
                :size="12"
                class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
            />
            <span v-if="field.required" class="tpl:text-[var(--tpl-danger)]">
                *
            </span>
        </label>

        <div class="tpl:flex tpl:flex-col tpl:gap-2">
            <div
                v-for="(item, index) in items"
                :key="index"
                class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:p-3"
            >
                <div
                    class="tpl:mb-2 tpl:flex tpl:items-center tpl:justify-between"
                >
                    <span
                        class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-dim)]"
                    >
                        #{{ index + 1 }}
                    </span>
                    <button
                        v-if="canRemove && !readOnly"
                        type="button"
                        class="tpl:flex tpl:size-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]"
                        :title="t.customBlocks.fields.removeItem"
                        @click="removeItem(index)"
                    >
                        <Trash2 :size="12" :stroke-width="2" />
                    </button>
                </div>

                <template v-for="subField in field.fields" :key="subField.key">
                    <component
                        :is="resolveFieldComponent(subField.type)"
                        :field="subField"
                        :model-value="item[subField.key]"
                        :read-only="readOnly"
                        @update:model-value="
                            updateItemField(index, subField.key, $event)
                        "
                    />
                </template>
            </div>

            <button
                v-if="canAdd && !readOnly"
                type="button"
                class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]"
                @click="addItem"
            >
                <Plus :size="14" :stroke-width="2" />
                {{ t.customBlocks.fields.addItem }}
            </button>

            <p
                v-if="!canAdd && !readOnly"
                class="tpl:m-0 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            >
                {{ t.customBlocks.fields.maxItemsReached }}
            </p>
        </div>
    </div>
</template>
