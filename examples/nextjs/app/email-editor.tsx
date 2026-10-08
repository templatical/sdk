"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplaticalEditor } from "@templatical/editor";
import "@templatical/editor/style.css";
import {
  renderProvider,
  savedBlocksProvider,
  templatesProvider,
  testEmailProvider,
} from "../lib/templatical/providers";

type Problem = { message: string; offerRestart: boolean };

// Every message ends as a sentence: the providers' fallback, such as
// "GET /api/templates/… failed (500)", has no full stop and would run into the
// restart link.
const messageOf = (error: unknown) => {
  const text = (error instanceof Error ? error.message : String(error)).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let instance: TemplaticalEditor | null = null;

    (async () => {
      // Imported inside the effect: the editor runs only in the browser.
      const { init } = await import("@templatical/editor");
      if (cancelled) return;
      const ed = await init({
        container,
        templates: templatesProvider,
        savedBlocks: savedBlocksProvider,
        testEmail: testEmailProvider,
        render: renderProvider,
        onError: (error) => {
          if (!cancelled) setProblem({ message: messageOf(error), offerRestart: false });
        },
      });
      if (cancelled) {
        ed.unmount();
        return;
      }
      instance = ed;
      editorRef.current = ed;

      // ?id= picks the template; without one, create a template and put its
      // id in the URL so a reload reopens the same template.
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) {
        await ed.load(id);
      } else {
        const template = await ed.create({ name: "Untitled" });
        if (!cancelled) window.history.replaceState(null, "", `?id=${template.id}`);
      }
    })().catch((error: unknown) => {
      // The providers throw the server's own message, such as "Template not found."
      if (!cancelled) setProblem({ message: messageOf(error), offerRestart: true });
    });

    return () => {
      cancelled = true;
      instance?.unmount();
      editorRef.current = null;
    };
  }, []);

  async function exportHtml() {
    // A new export replaces an earlier failure. A failed load keeps its message
    // and restart link: the template it names never opened.
    setProblem((current) => (current?.offerRestart ? current : null));
    // Opened inside the click, so a popup blocker allows it, and filled once
    // the HTML is ready.
    const tab = window.open("", "_blank");
    if (!tab) {
      setProblem({ message: "Allow pop-ups for this page to see the export.", offerRestart: false });
      return;
    }
    try {
      const html = await editorRef.current?.toHtml();
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
      setProblem({ message: messageOf(error), offerRestart: false });
    }
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" data-testid="export-html" onClick={exportHtml}>
          Export HTML
        </button>
        {problem && (
          <span role="alert">
            {problem.message}
            {problem.offerRestart && (
              <>
                {" "}
                {/* A full page load, not a router <Link>: only a fresh mount creates the template. */}
                <a href="/">Start a new template</a>.
              </>
            )}
          </span>
        )}
      </div>
      <div ref={containerRef} className="editor" />
    </>
  );
}
