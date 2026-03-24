<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';
import type { UseEditorReturn } from '@templatical/core';
import type {
    TableBlock as TableBlockType,
    ViewportSize,
} from '@templatical/types';
import { Table } from 'lucide-vue-next';
import { computed, inject } from 'vue';

const props = defineProps<{
    block: TableBlockType;
    viewport: ViewportSize;
}>();

const { t } = useI18n();
const editor = inject<UseEditorReturn>('editor')!;

const hasRows = computed(() => props.block.rows.length > 0);

const tableStyle = computed(() => ({
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: `${props.block.fontSize}px`,
    color: props.block.color,
    textAlign: props.block.textAlign as string,
    fontFamily: props.block.fontFamily || 'inherit',
}));

const cellStyle = computed(() => ({
    border: `${props.block.borderWidth}px solid ${props.block.borderColor}`,
    padding: `${props.block.cellPadding}px`,
    textAlign: props.block.textAlign as string,
}));

const headerCellStyle = computed(() => ({
    ...cellStyle.value,
    fontWeight: 'bold',
    backgroundColor: props.block.headerBackgroundColor || 'transparent',
}));

const headerRow = computed(() =>
    props.block.hasHeaderRow && props.block.rows.length > 0
        ? props.block.rows[0]
        : null,
);

const dataRows = computed(() =>
    props.block.hasHeaderRow ? props.block.rows.slice(1) : props.block.rows,
);

function onCellClick(): void {
    editor.selectBlock(props.block.id);
}

function onCellBlur(rowId: string, cellId: string, event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const content = target.innerText.trim();

    const updatedRows = props.block.rows.map((row) => {
        if (row.id !== rowId) return row;
        return {
            ...row,
            cells: row.cells.map((cell) =>
                cell.id === cellId ? { ...cell, content } : cell,
            ),
        };
    });

    editor.updateBlock(props.block.id, { rows: updatedRows });
}
</script>

<template>
    <div class="tpl:w-full">
        <table v-if="hasRows" :style="tableStyle" class="tpl-table-editable">
            <thead v-if="headerRow">
                <tr>
                    <th
                        v-for="cell in headerRow.cells"
                        :key="cell.id"
                        :style="headerCellStyle"
                        contenteditable="true"
                        :data-placeholder="t.table.cellPlaceholder"
                        @blur="onCellBlur(headerRow!.id, cell.id, $event)"
                        @keydown.enter.prevent="
                            ($event.target as HTMLElement).blur()
                        "
                        @click.stop="onCellClick"
                        v-text="cell.content"
                    />
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in dataRows" :key="row.id">
                    <td
                        v-for="cell in row.cells"
                        :key="cell.id"
                        :style="cellStyle"
                        contenteditable="true"
                        :data-placeholder="t.table.cellPlaceholder"
                        @blur="onCellBlur(row.id, cell.id, $event)"
                        @keydown.enter.prevent="
                            ($event.target as HTMLElement).blur()
                        "
                        @click.stop="onCellClick"
                        v-text="cell.content"
                    />
                </tr>
            </tbody>
        </table>
        <div
            v-else
            class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:text-sm"
            style="border-color: var(--tpl-border); color: var(--tpl-text-dim)"
        >
            <Table :size="16" />
            <span>{{ t.table.empty }}</span>
        </div>
    </div>
</template>

<style scoped>
.tpl-table-editable :deep(th[contenteditable]),
.tpl-table-editable :deep(td[contenteditable]) {
    outline: none;
    cursor: text;
    min-width: 2rem;
}

.tpl-table-editable :deep(th[contenteditable]:empty::before),
.tpl-table-editable :deep(td[contenteditable]:empty::before) {
    content: attr(data-placeholder);
    color: var(--tpl-text-dim);
    pointer-events: none;
}

.tpl-table-editable :deep(th[contenteditable]:focus),
.tpl-table-editable :deep(td[contenteditable]:focus) {
    outline: 2px solid var(--tpl-primary);
    outline-offset: -2px;
    border-radius: 1px;
}
</style>
