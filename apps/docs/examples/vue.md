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
import { init, unmount } from '@templatical/vue';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';

const props = defineProps<{
  content?: TemplateContent;
}>();

const emit = defineEmits<{
  change: [content: TemplateContent];
  save: [content: TemplateContent];
}>();

const container = ref<HTMLElement>();
const editor = ref<TemplaticalEditor>();

onMounted(() => {
  if (!container.value) return;

  editor.value = init({
    container: container.value,
    content: props.content,
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
});

onUnmounted(() => {
  unmount();
});

function exportHtml() {
  return editor.value?.toHtml?.();
}

defineExpose({ exportHtml });
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
  <EmailEditor @change="handleChange" @save="handleSave" />
</template>
```

## Dark Mode

```vue
<script setup lang="ts">
import { useDark } from '@vueuse/core';

const isDark = useDark();

// Re-initialize the editor when dark mode changes
// or pass darkMode: 'auto' to follow system preference
</script>
```

```ts
init({
  container: '#editor',
  darkMode: 'auto', // follows prefers-color-scheme
});
```

## With Custom Media Picker

```ts
init({
  container: '#editor',
  onRequestMedia(callback) {
    // Open your own Vue modal/dialog
    mediaPickerVisible.value = true;
    onMediaSelected = (url: string) => {
      callback(url);
      mediaPickerVisible.value = false;
    };
  },
});
```
