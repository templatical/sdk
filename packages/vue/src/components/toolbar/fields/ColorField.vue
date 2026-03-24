<script setup lang="ts">
import { useI18n } from '../../../composables/useI18n';
import type { CustomBlockColorField } from '@templatical/types';
import {
    colorInputClass,
    colorTextClass,
    labelClass,
} from '../../../constants/styleConstants';
import { Lock } from 'lucide-vue-next';

const props = defineProps<{
    field: CustomBlockColorField;
    modelValue: string;
    readOnly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();

const inputId = `tpl-color-${props.field.key ?? props.field.label.replace(/\s+/g, '-').toLowerCase()}`;
</script>

<template>
    <div class="tpl:mb-3.5">
        <label :for="inputId" :class="labelClass">
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
        <div
            :class="[
                'tpl:flex tpl:gap-2',
                readOnly && 'tpl:opacity-60 tpl:cursor-not-allowed',
            ]"
            :title="
                readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined
            "
        >
            <input
                type="color"
                :class="colorInputClass"
                :value="modelValue || '#000000'"
                :disabled="readOnly"
                @input="
                    !readOnly &&
                    emit(
                        'update:modelValue',
                        ($event.target as HTMLInputElement).value,
                    )
                "
            />
            <input
                :id="inputId"
                type="text"
                :class="colorTextClass"
                :value="modelValue"
                :placeholder="field.placeholder || '#000000'"
                :disabled="readOnly"
                @input="
                    !readOnly &&
                    emit(
                        'update:modelValue',
                        ($event.target as HTMLInputElement).value,
                    )
                "
            />
        </div>
    </div>
</template>
