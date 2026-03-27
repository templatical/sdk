---
title: Vue 3
description: Integrating Templatical into a Vue 3 application.
---

# Vue 3

Templatical is built on Vue 3, so integration is straightforward.

## Setup

```bash
npm install @templatical/vue @templatical/renderer
```

## Component

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';

const props = defineProps<{
  content?: TemplateContent;
  darkMode?: boolean | 'auto';
}>();

const emit = defineEmits<{
  change: [content: TemplateContent];
  save: [content: TemplateContent];
}>();

const container = ref<HTMLElement>();
let editor: TemplaticalEditor | null = null;

function mountEditor() {
  if (!container.value) return;

  editor = init({
    container: container.value,
    content: props.content,
    darkMode: props.darkMode ?? false,
    onChange: (content) => emit('change', content),
    onSave: (content) => emit('save', content),
    mergeTags: {
      syntax: 'liquid',
      tags: [
        { label: 'First Name', value: '{{first_name}}' },
        { label: 'Email', value: '{{email}}' },
      ],
    },
  });
}

onMounted(() => {
  mountEditor();
});

onUnmounted(() => {
  editor?.unmount();
  editor = null;
});

function getContent() {
  return editor?.getContent();
}

function exportMjml() {
  return editor?.toMjml?.();
}

defineExpose({ getContent, exportMjml });
</script>

<template>
  <div ref="container" class="email-editor" />
</template>

<style scoped>
.email-editor {
  height: 100vh;
}
</style>
```

## Usage

```vue
<script setup lang="ts">
import EmailEditor from '@/components/EmailEditor.vue';
import type { TemplateContent } from '@templatical/types';

function handleChange(content: TemplateContent) {
  console.log('Template changed:', content);
}

function handleSave(content: TemplateContent) {
  fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  });
}
</script>

<template>
  <EmailEditor
    dark-mode="auto"
    @change="handleChange"
    @save="handleSave"
  />
</template>
```

## Dark mode

The simplest approach is `darkMode: 'auto'`, which follows the user's system preference:

```ts
init({
  container: '#editor',
  darkMode: 'auto',
});
```

If you need to toggle dark mode programmatically, you must re-initialize the editor because `darkMode` is not reactive after initialization:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';

const isDark = ref(false);
const container = ref<HTMLElement>();
let editor: TemplaticalEditor | null = null;

function mountEditor() {
  // Preserve current content across re-mounts
  const currentContent = editor?.getContent();
  editor?.unmount();

  if (!container.value) return;

  editor = init({
    container: container.value,
    content: currentContent,
    darkMode: isDark.value,
  });
}

watch(isDark, () => mountEditor());
</script>
```

## With custom media picker

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';

const container = ref<HTMLElement>();
const showMediaPicker = ref(false);
let mediaCallback: ((url: string) => void) | null = null;

function onMounted() {
  if (!container.value) return;

  init({
    container: container.value,
    onRequestMedia(callback) {
      // Store the callback and open your picker UI
      mediaCallback = callback;
      showMediaPicker.value = true;
    },
  });
}

// Called when the user selects an image in your picker
function onImageSelected(url: string) {
  mediaCallback?.(url);
  mediaCallback = null;
  showMediaPicker.value = false;
}

// Called when the user cancels the picker
function onPickerClose() {
  mediaCallback = null; // Don't call the callback — editor stays unchanged
  showMediaPicker.value = false;
}
</script>

<template>
  <div ref="container" style="height: 100vh" />

  <!-- Your media picker modal -->
  <MyMediaPicker
    v-if="showMediaPicker"
    @select="onImageSelected"
    @close="onPickerClose"
  />
</template>
```
