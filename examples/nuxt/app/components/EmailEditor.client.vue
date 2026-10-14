<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { TemplaticalEditor } from "@templatical/editor";
import "@templatical/editor/style.css";
import {
  renderProvider,
  savedBlocksProvider,
  templatesProvider,
  testEmailProvider,
} from "../utils/templatical/providers";

type Problem = { message: string; offerRestart: boolean };

// Every message ends as a sentence: the providers' fallback, such as
// "GET /api/templates/… failed (500)", has no full stop and would run into the
// restart link.
const messageOf = (error: unknown) => {
  const text = (error instanceof Error ? error.message : String(error)).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const container = ref<HTMLDivElement>();
const problem = ref<Problem | null>(null);
let editor: TemplaticalEditor | null = null;
let unmounted = false;

async function openEditor(el: HTMLDivElement) {
  // Imported here, not at the top: the editor runs only in the browser.
  const { init } = await import("@templatical/editor");
  if (unmounted) return;
  const instance = await init({
    container: el,
    templates: templatesProvider,
    savedBlocks: savedBlocksProvider,
    testEmail: testEmailProvider,
    render: renderProvider,
    onError: (error) => {
      if (!unmounted) problem.value = { message: messageOf(error), offerRestart: false };
    },
  });
  if (unmounted) {
    instance.unmount();
    return;
  }
  editor = instance;

  // ?id= picks the template; without one, create a template and put its id in
  // the URL so a reload reopens the same template.
  const id = new URLSearchParams(window.location.search).get("id");
  if (id) {
    await instance.load(id);
  } else {
    const template = await instance.create({ name: "Untitled" });
    if (!unmounted) window.history.replaceState(window.history.state, "", `?id=${template.id}`);
  }
}

onMounted(async () => {
  // Nuxt renders a .client.vue component's template one tick after the
  // component mounts, so the container does not exist until then.
  await nextTick();
  const el = container.value;
  if (!el) return;
  openEditor(el).catch((error: unknown) => {
    // The providers throw the server's own message, such as "Template not found."
    if (!unmounted) problem.value = { message: messageOf(error), offerRestart: true };
  });
});

onBeforeUnmount(() => {
  unmounted = true;
  editor?.unmount();
  editor = null;
});

async function exportHtml() {
  // A new export replaces an earlier failure. A failed load keeps its message
  // and restart link: the template it names never opened.
  if (!problem.value?.offerRestart) problem.value = null;
  // Opened inside the click, so a popup blocker allows it, and filled once
  // the HTML is ready.
  const tab = window.open("", "_blank");
  if (!tab) {
    problem.value = { message: "Allow pop-ups for this page to see the export.", offerRestart: false };
    return;
  }
  try {
    const html = await editor?.toHtml();
    if (!html) {
      tab.close();
      return;
    }
    // The HTML renders in a sandboxed frame: HTML blocks and rich text are
    // author content, and in this tab they would run with the app's origin.
    const frame = tab.document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.srcdoc = html;
    frame.style.cssText = "border: 0; width: 100%; height: 100%";
    tab.document.documentElement.style.height = "100%";
    tab.document.body.style.cssText = "margin: 0; height: 100%";
    tab.document.body.append(frame);
  } catch (error) {
    tab.close();
    problem.value = { message: messageOf(error), offerRestart: false };
  }
}
</script>

<template>
  <div class="toolbar">
    <button type="button" data-testid="export-html" @click="exportHtml">Export HTML</button>
    <span v-if="problem" role="alert">
      {{ problem.message }}
      <template v-if="problem.offerRestart"><a href="/">Start a new template</a>.</template>
    </span>
  </div>
  <div ref="container" class="editor" />
</template>
