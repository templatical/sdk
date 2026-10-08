<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import type { TemplaticalEditor } from "@templatical/editor";
  import "@templatical/editor/style.css";
  import {
    renderProvider,
    savedBlocksProvider,
    templatesProvider,
    testEmailProvider,
  } from "#lib/templatical/providers.ts";

  type Problem = { message: string; offerRestart: boolean };

  const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  let container: HTMLDivElement;
  let editor: TemplaticalEditor | null = null;
  let problem = $state<Problem | null>(null);

  onMount(() => {
    let cancelled = false;

    (async () => {
      // Imported here, not at the top: the editor runs only in the browser.
      const { init } = await import("@templatical/editor");
      if (cancelled) return;
      const instance = await init({
        container,
        templates: templatesProvider,
        savedBlocks: savedBlocksProvider,
        testEmail: testEmailProvider,
        render: renderProvider,
        onError: (error) => {
          if (!cancelled) problem = { message: error.message, offerRestart: false };
        },
      });
      if (cancelled) {
        instance.unmount();
        return;
      }
      editor = instance;

      // ?id= picks the template; without one, create a template and put its
      // id in the URL so a reload reopens the same template.
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) {
        await instance.load(id);
      } else {
        const template = await instance.create({ name: "Untitled" });
        if (!cancelled) await goto(`?id=${template.id}`, { replace: true, shallow: true });
      }
    })().catch((error: unknown) => {
      // The providers throw the server's own message, such as "Template not found."
      if (!cancelled) problem = { message: messageOf(error), offerRestart: true };
    });

    return () => {
      cancelled = true;
      editor?.unmount();
      editor = null;
    };
  });

  async function exportHtml() {
    // Opened inside the click, so a popup blocker allows it, and filled once
    // the HTML is ready.
    const tab = window.open("", "_blank");
    if (!tab) {
      problem = { message: "Allow pop-ups for this page to see the export.", offerRestart: false };
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
      problem = { message: messageOf(error), offerRestart: false };
    }
  }
</script>

<div class="toolbar">
  <button type="button" data-testid="export-html" onclick={exportHtml}>Export HTML</button>
  {#if problem}
    <!-- data-sveltekit-reload makes the restart a full page load: a client-side navigation to "/" keeps this component mounted, so onMount would not run and no template would be created. -->
    <span role="alert">
      {problem.message}
      {#if problem.offerRestart}<a href="/" data-sveltekit-reload>Start a new template</a>.{/if}
    </span>
  {/if}
</div>
<div bind:this={container} class="editor"></div>
