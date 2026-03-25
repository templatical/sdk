<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';

const props = defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const container = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
let skipUpdate = false;

onMounted(() => {
    if (!container.value) return;

    view = new EditorView({
        parent: container.value,
        state: EditorState.create({
            doc: props.modelValue,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                foldGutter(),
                bracketMatching(),
                closeBrackets(),
                json(),
                syntaxHighlighting(defaultHighlightStyle),
                keymap.of([...defaultKeymap, indentWithTab]),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        skipUpdate = true;
                        emit('update:modelValue', update.state.doc.toString());
                        skipUpdate = false;
                    }
                }),
            ],
        }),
    });
});

watch(() => props.modelValue, (newValue) => {
    if (!view || skipUpdate) return;
    const current = view.state.doc.toString();
    if (newValue !== current) {
        view.dispatch({
            changes: { from: 0, to: current.length, insert: newValue },
        });
    }
});

onUnmounted(() => {
    view?.destroy();
    view = null;
});
</script>

<template>
    <div ref="container" class="h-[min(480px,60vh)] border border-gray-200 rounded-lg overflow-auto text-sm" />
</template>
