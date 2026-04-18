<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, type Ref } from "vue";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  bracketMatching,
} from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";

const isDark = inject<Ref<boolean>>("isDark", ref(false));

const props = defineProps<{
  modelValue: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const container = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
let skipUpdate = false;
const themeConf = new Compartment();

function getThemeExtension(dark: boolean) {
  return dark ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle)];
}

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
        themeConf.of(getThemeExtension(isDark.value)),
        keymap.of([...defaultKeymap, indentWithTab]),
        ...(props.ariaLabel
          ? [
              EditorView.contentAttributes.of({
                "aria-label": props.ariaLabel,
              }),
            ]
          : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            skipUpdate = true;
            emit("update:modelValue", update.state.doc.toString());
            skipUpdate = false;
          }
        }),
      ],
    }),
  });
});

watch(isDark, (dark) => {
  if (view) {
    view.dispatch({
      effects: themeConf.reconfigure(getThemeExtension(dark)),
    });
  }
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (!view || skipUpdate) return;
    const current = view.state.doc.toString();
    if (newValue !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: newValue },
      });
    }
  },
);

onUnmounted(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div
    ref="container"
    class="h-[min(480px,60vh)] border border-gray-200 rounded-lg overflow-auto text-sm dark:border-gray-700"
  />
</template>
