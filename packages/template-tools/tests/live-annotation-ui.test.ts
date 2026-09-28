import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HARNESS = readFileSync(
  resolve(import.meta.dirname, "../live/index.html"),
  "utf8",
);

describe("annotation capture UI", () => {
  it("posts notes to the bridge's annotation endpoint", () => {
    expect(HARNESS).toContain("/annotations");
  });

  it("derives the block id from data-block-id", () => {
    expect(HARNESS).toContain("data-block-id");
  });

  it("walks composedPath, not event.target", () => {
    // The editor mounts in shadow DOM by default, so a click retargets at the
    // boundary and event.target is the host element, not the block.
    expect(HARNESS).toContain("composedPath");
    expect(HARNESS).not.toMatch(/\bevent\.target\.dataset\b/);
  });

  it("has a note affordance and a note input", () => {
    expect(HARNESS).toContain('id="note-panel"');
    expect(HARNESS).toContain('id="note-text"');
  });

  it("registers the click listener on the capture phase", () => {
    // BlockWrapper.handleClick calls stopPropagation() on every block click,
    // so a bubble-phase listener on `document` never sees it — capture runs
    // root-to-target, before that stopPropagation is reached.
    const match = HARNESS.match(
      /document\.addEventListener\(\s*["']click["'][\s\S]*?\n\s*(true|false),\s*\n\s*\);/,
    );
    expect(match?.[1]).toBe("true");
  });

  it("explains the Live status in a hover tip", () => {
    expect(HARNESS).toContain('id="status-tip"');
    expect(HARNESS).toContain(
      "Connected. Edits here and the agent's changes both show up on this page.",
    );
    const setStatus = HARNESS.indexOf("function setStatus");
    expect(HARNESS.slice(setStatus, setStatus + 300)).toContain(
      '$("status-tip").textContent',
    );
  });

  it("gives Annotate a pressed style and lets Cancel dismiss an empty composer", () => {
    expect(HARNESS).toContain(
      '#annotate-toggle[aria-pressed="true"]',
    );
    const cancel = HARNESS.indexOf('$("note-cancel").onclick');
    expect(cancel).toBeGreaterThan(-1);
    expect(HARNESS.slice(cancel, cancel + 400)).toContain("setAnnotating(false)");
  });

  it("annotates from a toggle, not from alt-click", () => {
    expect(HARNESS).toContain('id="annotate-toggle"');
    expect(HARNESS).toContain("aria-pressed");
    expect(HARNESS).not.toContain("altKey");
  });

  it("stops mousedown on the canvas while annotating, in the capture phase", () => {
    // mousedown is what focuses a contenteditable. A click-only stop still
    // lets the rich-text block enter edit, so the note gesture edits the email.
    const match = HARNESS.match(
      /document\.addEventListener\(\s*["']mousedown["'][\s\S]*?\n\s*(true|false),\s*\n\s*\);/,
    );
    expect(match?.[1]).toBe("true");
    const fnStart = HARNESS.indexOf("function onAnnotatePointer");
    expect(fnStart).toBeGreaterThan(-1);
    const fn = HARNESS.slice(fnStart, fnStart + 700);
    expect(fn).toContain("stopPropagation()");
    expect(fn).toContain("preventDefault()");
    expect(fn).toContain("pathHitsCanvas");
    const guard = HARNESS.indexOf("function pathHitsCanvas");
    expect(HARNESS.slice(guard, guard + 300)).toContain("tpl-canvas");
  });

  it("posts the parent id, block type, and label", () => {
    expect(HARNESS).toContain("parentBlockId");
    expect(HARNESS).toContain("blockType");
    expect(HARNESS).toContain("label");
  });

  it("lists notes, restores them from GET /content, and writes the ask-the-agent footer", () => {
    expect(HARNESS).toContain('id="note-list"');
    expect(HARNESS).toContain('id="note-footer"');
    expect(HARNESS).toContain("Ask your agent to apply these.");
    expect(HARNESS).toContain("This block is no longer on the canvas.");
    expect(HARNESS).toContain('method: "PUT"');
    expect(HARNESS).toContain('method: "DELETE"');
    expect(HARNESS).toContain("refreshNotes");
  });

  it("re-reads the note queue when the agent pushes a template", () => {
    const start = HARNESS.indexOf("async function applyRemote");
    const end = HARNESS.indexOf("// ---- Export ----", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(HARNESS.slice(start, end)).toContain("await refreshNotes()");
  });

  it("hides the queue count when there are no notes", () => {
    expect(HARNESS).toContain('id="annotate-count"');
  });

  it("outlines noted blocks from a style element in the shadow root, scoped to the canvas", () => {
    expect(HARNESS).toContain('style.id = "note-outlines"');
    expect(HARNESS).toContain("shadowRoot.appendChild");
    expect(HARNESS).toContain(".tpl-canvas [data-block-id=");
    expect(HARNESS).toContain("outline: 2px solid var(--tpl-primary)");
    expect(HARNESS).toContain("outline-offset: 2px");
    expect(HARNESS).toContain("CSS.escape");
  });

  it("places badge buttons in the harness document, beside the editor host", () => {
    expect(HARNESS).toContain('<div id="editor"></div>');
    expect(HARNESS).toContain('id="note-badges"');
    const editorAt = HARNESS.indexOf('id="editor"');
    const badgesAt = HARNESS.indexOf('id="note-badges"');
    expect(badgesAt).toBeGreaterThan(editorAt);
  });

  it("numbers a shared block as the first note's index plus a count", () => {
    expect(HARNESS).toContain("NUDGE_GAP = 18");
    expect(HARNESS).toContain("NUDGE_DROP = 22");
    expect(HARNESS).toContain('group.number + "+" + group.extra');
  });

  it("tracks badges from the canvas scroller and drops the loop when the queue is empty", () => {
    expect(HARNESS).toContain("ResizeObserver");
    expect(HARNESS).toContain(".tpl-body");
    expect(HARNESS).toContain("requestAnimationFrame");
    expect(HARNESS).toContain("if (notes.length === 0) return;");
  });
});
