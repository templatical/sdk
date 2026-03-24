<script setup lang="ts">
import { useI18n } from '../../composables';
import { blockTypeIcons } from '../../utils/blockTypeIcons';
import type { UseEditorReturn } from '@templatical/core/cloud';
import type { UseSavedModulesReturn } from '@templatical/core/cloud';
import type { SavedModule } from '@templatical/types';
import { Package, Search, Trash2, X } from 'lucide-vue-next';
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue';

const props = defineProps<{
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'insert', module: SavedModule, insertIndex: number | undefined): void;
}>();

const ModulePreviewCanvas = defineAsyncComponent(
    () => import('./ModulePreviewCanvas.vue'),
);

const { t } = useI18n();
const savedModules = inject<UseSavedModulesReturn>('savedModulesHeadless')!;
const editor = inject<UseEditorReturn>('editor')!;

const searchQuery = ref('');
const selectedModuleId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);
// 'end' = append, 'beginning' = index 0, or block id = after that block
const insertPosition = ref<string>('end');

const filteredModules = computed(() => {
    const modules = savedModules.modules.value;
    if (!searchQuery.value) return modules;
    const query = searchQuery.value.toLowerCase();
    return modules.filter((m) => m.name.toLowerCase().includes(query));
});

const selectedModule = computed(() => {
    if (!selectedModuleId.value) return null;
    return (
        savedModules.modules.value.find(
            (m) => m.id === selectedModuleId.value,
        ) ?? null
    );
});

interface PositionOption {
    value: string;
    label: string;
}

const positionOptions = computed<PositionOption[]>(() => {
    const options: PositionOption[] = [
        { value: 'beginning', label: t.modules.insertAtBeginning },
    ];
    const blocks = editor.content.value.blocks;
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const typeKey = block.type as keyof typeof t.blocks;
        const label = t.blocks[typeKey] ?? block.type;
        options.push({
            value: block.id,
            label: t.modules.insertAfterBlock.replace(
                '{block}',
                `${label} ${i + 1}`,
            ),
        });
    }
    options.push({ value: 'end', label: t.modules.insertAtEnd });
    return options;
});

const resolvedInsertIndex = computed<number | undefined>(() => {
    if (insertPosition.value === 'end') return undefined;
    if (insertPosition.value === 'beginning') return 0;
    const blocks = editor.content.value.blocks;
    const idx = blocks.findIndex((b) => b.id === insertPosition.value);
    if (idx !== -1) return idx + 1;
    return undefined;
});

watch(
    () => props.visible,
    (visible) => {
        if (visible) {
            searchQuery.value = '';
            selectedModuleId.value = null;
            confirmDeleteId.value = null;
            // Default to after selected block, or end
            const selectedId = editor.state.selectedBlockId;
            if (selectedId) {
                const idx = editor.content.value.blocks.findIndex(
                    (b) => b.id === selectedId,
                );
                insertPosition.value = idx !== -1 ? selectedId : 'end';
            } else {
                insertPosition.value = 'end';
            }
        }
    },
);

function getModuleBlockTypeIcons(
    module: SavedModule,
): { type: string; icon: unknown }[] {
    const icons: { type: string; icon: unknown }[] = [];
    const seen = new Set<string>();
    for (const block of module.content) {
        if (!seen.has(block.type) && blockTypeIcons[block.type]) {
            seen.add(block.type);
            icons.push({ type: block.type, icon: blockTypeIcons[block.type] });
        }
        if (icons.length >= 5) break;
    }
    return icons;
}

function getRemainingTypeCount(module: SavedModule): number {
    const types = new Set(module.content.map((b) => b.type));
    return Math.max(0, types.size - 5);
}

async function handleDelete(moduleId: string): Promise<void> {
    try {
        await savedModules.deleteModule(moduleId);
        if (selectedModuleId.value === moduleId) {
            selectedModuleId.value = null;
        }
    } finally {
        confirmDeleteId.value = null;
    }
}

function handleInsert(): void {
    if (selectedModule.value) {
        emit('insert', selectedModule.value, resolvedInsertIndex.value);
    }
}

function handleClose(): void {
    emit('close');
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        handleClose();
    }
    if (event.key === 'Enter' && selectedModule.value) {
        event.preventDefault();
        handleInsert();
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="tpl:transition tpl:duration-150"
            enter-from-class="tpl:opacity-0"
            enter-to-class="tpl:opacity-100"
            leave-active-class="tpl:transition tpl:duration-100"
            leave-from-class="tpl:opacity-100"
            leave-to-class="tpl:opacity-0"
        >
            <div
                v-if="visible"
                class="tpl tpl:fixed tpl:inset-0 tpl:z-[10000] tpl:flex tpl:items-center tpl:justify-center"
                style="
                    background-color: var(--tpl-overlay);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                "
                @click.self="handleClose"
                @keydown="handleKeydown"
            >
                <div
                    class="tpl-scale-in tpl:mx-4 tpl:flex tpl:w-full tpl:max-w-[1000px] tpl:flex-col tpl:rounded-[var(--tpl-radius-lg)]"
                    style="
                        background-color: var(--tpl-bg-elevated);
                        box-shadow: var(--tpl-shadow-xl);
                        max-height: 90vh;
                    "
                >
                    <!-- Header -->
                    <div
                        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:px-5 tpl:py-4"
                        style="border-color: var(--tpl-border)"
                    >
                        <h3
                            class="tpl:text-sm tpl:font-semibold"
                            style="color: var(--tpl-text)"
                        >
                            {{ t.modules.browse }}
                        </h3>
                        <button
                            class="tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-1 tpl:transition-colors tpl:duration-100"
                            style="color: var(--tpl-text-dim)"
                            @click="handleClose"
                        >
                            <X :size="16" :stroke-width="2" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div
                        class="tpl:flex tpl:min-h-0 tpl:flex-1 tpl:overflow-hidden"
                    >
                        <!-- Left panel: module grid -->
                        <div
                            class="tpl:flex tpl:w-[300px] tpl:shrink-0 tpl:flex-col tpl:overflow-hidden"
                        >
                            <!-- Search -->
                            <div class="tpl:px-4 tpl:pt-4 tpl:pb-3">
                                <div class="tpl:relative">
                                    <Search
                                        :size="14"
                                        :stroke-width="2"
                                        class="tpl:pointer-events-none tpl:absolute tpl:left-3 tpl:top-1/2 tpl:-translate-y-1/2"
                                        style="color: var(--tpl-text-dim)"
                                    />
                                    <input
                                        v-model="searchQuery"
                                        type="text"
                                        :placeholder="t.modules.search"
                                        class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:pl-9 tpl:pr-3 tpl:text-sm tpl:outline-none"
                                        style="
                                            border-color: var(--tpl-border);
                                            background-color: var(--tpl-bg);
                                            color: var(--tpl-text);
                                        "
                                    />
                                </div>
                            </div>

                            <!-- Grid -->
                            <div
                                class="tpl:flex-1 tpl:overflow-y-auto tpl:px-4 tpl:pb-4"
                            >
                                <div
                                    v-if="filteredModules.length > 0"
                                    class="tpl:flex tpl:flex-col tpl:gap-1"
                                >
                                    <div
                                        v-for="mod in filteredModules"
                                        :key="mod.id"
                                        class="tpl:group/card tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:px-3 tpl:py-2 tpl:transition-all tpl:duration-[120ms]"
                                        :style="{
                                            borderColor:
                                                selectedModuleId === mod.id
                                                    ? 'var(--tpl-primary)'
                                                    : 'var(--tpl-border)',
                                            backgroundColor:
                                                selectedModuleId === mod.id
                                                    ? 'var(--tpl-primary-light)'
                                                    : 'transparent',
                                        }"
                                        @click="selectedModuleId = mod.id"
                                    >
                                        <div
                                            class="tpl:flex tpl:items-center tpl:gap-2"
                                        >
                                            <span
                                                class="tpl:flex-1 tpl:truncate tpl:text-xs tpl:font-semibold"
                                                style="color: var(--tpl-text)"
                                            >
                                                {{ mod.name }}
                                            </span>
                                            <span
                                                class="tpl:shrink-0 tpl:rounded-full tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium"
                                                style="
                                                    background-color: var(
                                                        --tpl-bg-hover
                                                    );
                                                    color: var(
                                                        --tpl-text-muted
                                                    );
                                                "
                                            >
                                                {{
                                                    t.modules.blockCount.replace(
                                                        '{count}',
                                                        String(
                                                            mod.content.length,
                                                        ),
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <div
                                            class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-1"
                                        >
                                            <component
                                                :is="icon.icon"
                                                v-for="icon in getModuleBlockTypeIcons(
                                                    mod,
                                                )"
                                                :key="icon.type"
                                                :size="14"
                                                :stroke-width="1.5"
                                                style="
                                                    color: var(--tpl-text-dim);
                                                "
                                            />
                                            <span
                                                v-if="
                                                    getRemainingTypeCount(mod) >
                                                    0
                                                "
                                                class="tpl:text-[10px]"
                                                style="
                                                    color: var(--tpl-text-dim);
                                                "
                                            >
                                                +{{
                                                    getRemainingTypeCount(mod)
                                                }}
                                            </span>
                                            <button
                                                v-if="
                                                    confirmDeleteId === mod.id
                                                "
                                                class="tpl:ml-auto tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:transition-colors tpl:duration-100"
                                                style="
                                                    border-color: var(
                                                        --tpl-danger
                                                    );
                                                    color: var(--tpl-danger);
                                                    background-color: transparent;
                                                "
                                                @click.stop="
                                                    handleDelete(mod.id)
                                                "
                                            >
                                                {{ t.modules.deleteConfirm }}
                                            </button>
                                            <button
                                                v-else
                                                class="tpl-module-delete-btn tpl:ml-auto tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:transition-colors tpl:duration-100"
                                                style="
                                                    color: var(--tpl-text-dim);
                                                "
                                                :title="t.modules.delete"
                                                @click.stop="
                                                    confirmDeleteId = mod.id
                                                "
                                            >
                                                <Trash2
                                                    :size="12"
                                                    :stroke-width="1.5"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Empty state -->
                                <div
                                    v-else
                                    class="tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:py-12"
                                >
                                    <Package
                                        :size="32"
                                        :stroke-width="1"
                                        style="color: var(--tpl-text-dim)"
                                    />
                                    <p
                                        class="tpl:mt-2 tpl:text-xs"
                                        style="color: var(--tpl-text-dim)"
                                    >
                                        {{
                                            searchQuery
                                                ? t.modules.noModules
                                                : t.modules.noModulesHint
                                        }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Right panel: preview -->
                        <div
                            class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-hidden tpl:border-l"
                            style="border-color: var(--tpl-border)"
                        >
                            <div
                                v-if="selectedModule"
                                class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-hidden"
                            >
                                <!-- Visual preview -->
                                <div
                                    class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4"
                                >
                                    <ModulePreviewCanvas
                                        :blocks="selectedModule.content"
                                    />
                                </div>
                            </div>

                            <!-- Empty preview state -->
                            <div
                                v-else
                                class="tpl:flex tpl:flex-1 tpl:flex-col tpl:items-center tpl:justify-center tpl:px-4"
                            >
                                <Package
                                    :size="32"
                                    :stroke-width="1"
                                    style="color: var(--tpl-text-dim)"
                                />
                                <p
                                    class="tpl:mt-2 tpl:text-center tpl:text-xs"
                                    style="color: var(--tpl-text-dim)"
                                >
                                    {{ t.modules.selectToPreview }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div
                        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-t tpl:px-5 tpl:py-3"
                        style="border-color: var(--tpl-border)"
                    >
                        <div class="tpl:flex tpl:items-center tpl:gap-2">
                            <label
                                class="tpl:shrink-0 tpl:text-xs"
                                style="color: var(--tpl-text-dim)"
                            >
                                {{ t.modules.insertPosition }}
                            </label>
                            <select
                                v-model="insertPosition"
                                class="tpl:h-7 tpl:max-w-[220px] tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none"
                                style="
                                    border-color: var(--tpl-border);
                                    background-color: var(--tpl-bg);
                                    color: var(--tpl-text);
                                "
                            >
                                <option
                                    v-for="opt in positionOptions"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                    {{ opt.label }}
                                </option>
                            </select>
                        </div>
                        <div class="tpl:flex tpl:gap-2">
                            <button
                                type="button"
                                class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150"
                                style="
                                    border-color: var(--tpl-border);
                                    color: var(--tpl-text);
                                    background-color: var(--tpl-bg);
                                "
                                @click="handleClose"
                            >
                                {{ t.modules.close }}
                            </button>
                            <button
                                type="button"
                                class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
                                style="
                                    background-color: var(--tpl-primary);
                                    color: var(--tpl-bg);
                                "
                                :disabled="!selectedModule"
                                @click="handleInsert"
                            >
                                {{ t.modules.insert }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style>
.tpl-module-delete-btn:hover {
    color: var(--tpl-danger) !important;
}
</style>
