import { useEffect, useRef, useState } from "react";
import {
  createLocalStorageSavedBlocksProvider,
  init,
  type TemplaticalEditor,
} from "@templatical/editor";
import type { TemplateContent } from "@templatical/types";
import "@templatical/editor/style.css";

// Everything here runs in the browser: the template is kept in localStorage,
// and saved blocks use the editor's own localStorage provider. To store them
// on a server instead, use the fetch-based providers from any full-stack
// example (lib/templatical/providers.ts in examples/nextjs).
const CONTENT_KEY = "templatical-example:content";

function storedContent(): TemplateContent | undefined {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    return raw ? (JSON.parse(raw) as TemplateContent) : undefined;
  } catch {
    return undefined;
  }
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);
  const [mjml, setMjml] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let instance: TemplaticalEditor | null = null;

    (async () => {
      const ed = await init({
        container,
        content: storedContent(),
        onChange(content) {
          localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
        },
        savedBlocks: createLocalStorageSavedBlocksProvider(),
        onError: (error) => {
          if (!cancelled) setProblem(error.message);
        },
      });
      if (cancelled) {
        ed.unmount();
        return;
      }
      instance = ed;
      editorRef.current = ed;
    })().catch((error: unknown) => {
      if (!cancelled) setProblem(messageOf(error));
    });

    return () => {
      cancelled = true;
      instance?.unmount();
      editorRef.current = null;
    };
  }, []);

  async function exportMjml() {
    const ed = editorRef.current;
    // No editor yet, or it failed to start: nothing to export, and a start
    // failure keeps its alert.
    if (!ed) return;
    // A new export replaces an earlier failure.
    setProblem(null);
    try {
      setMjml(await ed.toMjml());
    } catch (error) {
      setProblem(messageOf(error));
    }
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" data-testid="export-mjml" onClick={exportMjml}>
          Export MJML
        </button>
        {problem && <span role="alert">{problem}</span>}
      </div>
      <div className="workspace">
        <div ref={containerRef} className="editor" />
        {mjml && (
          <pre data-testid="export-output" className="output">
            {mjml}
          </pre>
        )}
      </div>
    </>
  );
}
