<script setup lang="ts">
import { onMounted, onUnmounted, ref, type ShallowRef, shallowRef } from "vue";
import { init, type TemplaticalEditor } from "@templatical/editor";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  type TemplateContent,
} from "@templatical/types";

/**
 * Multi-instance playground route. Mounts two independent shadow-DOM
 * editors side by side so e2e specs can verify that:
 *   - Popovers (link dialog, toolbars) stay scoped to their editor.
 *   - Theme variables don't bleed between instances.
 *   - Keyboard shortcuts target only the focused editor.
 *   - Drag-drop in one editor doesn't affect the other.
 *
 * Both instances mount with `shadowDom: true` because that's the
 * regression surface that needs gating. Light-DOM multi-instance is a
 * separate concern (the SDK assumes one editor per page in light mode).
 */

const containerA = ref<HTMLDivElement | null>(null);
const containerB = ref<HTMLDivElement | null>(null);
const editorA: ShallowRef<TemplaticalEditor | null> = shallowRef(null);
const editorB: ShallowRef<TemplaticalEditor | null> = shallowRef(null);

function seedContent(label: string): TemplateContent {
  const base = createDefaultTemplateContent();
  base.blocks = [{ ...createTitleBlock(), content: label }];
  return base;
}

const seedContentA = seedContent("Instance A");
const seedContentB = seedContent("Instance B");

onMounted(async () => {
  if (containerA.value) {
    editorA.value = await init({
      container: containerA.value,
      shadowDom: true,
      content: seedContentA,
    });
  }
  if (containerB.value) {
    editorB.value = await init({
      container: containerB.value,
      shadowDom: true,
      content: seedContentB,
    });
  }
});

onUnmounted(() => {
  editorA.value?.unmount();
  editorB.value?.unmount();
});
</script>

<template>
  <div class="multi-root" data-testid="multi-instance-screen">
    <header class="multi-header">
      <a href="#" class="multi-back" data-testid="multi-back">← Back</a>
      <h1>Multi-instance shadow-DOM playground</h1>
      <p>
        Two editors mounted with <code>shadowDom: true</code>. Used by e2e specs
        to verify isolation between instances.
      </p>
    </header>
    <div class="multi-grid">
      <section>
        <div
          ref="containerA"
          class="multi-editor"
          data-testid="multi-editor-a"
        ></div>
      </section>
      <section>
        <div
          ref="containerB"
          class="multi-editor"
          data-testid="multi-editor-b"
        ></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.multi-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--pg-bg, #f8f8f8);
}
.multi-header {
  padding: 12px 20px;
  border-bottom: 1px solid #e5e5e5;
}
.multi-header h1 {
  margin: 4px 0;
  font-size: 18px;
}
.multi-header p {
  margin: 0;
  font-size: 13px;
  color: #666;
}
.multi-back {
  font-size: 13px;
  color: #0070f3;
  text-decoration: none;
}
.multi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  flex: 1;
  min-height: 0;
}
.multi-grid > section {
  display: flex;
  min-height: 0;
}
.multi-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}
</style>
