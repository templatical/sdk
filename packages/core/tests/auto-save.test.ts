import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref } from "@vue/reactivity";
import type { TemplateContent } from "@templatical/types";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { useAutoSave, DEFAULT_AUTO_SAVE_DEBOUNCE_MS } from "../src/auto-save";
import { useEditor } from "../src/editor";

function makeContent(): TemplateContent {
  return createDefaultTemplateContent();
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The one default both entry points read — `init()` falls through to it, and
   * `initCloud()` injects it explicitly. The editor package used to keep a
   * second copy at 5000, which drifted from this one with nothing linking them.
   */
  it("defaults to DEFAULT_AUTO_SAVE_DEBOUNCE_MS, which is 2 seconds", () => {
    expect(DEFAULT_AUTO_SAVE_DEBOUNCE_MS).toBe(2000);

    const content = ref(makeContent());
    const onChange = vi.fn();
    useAutoSave({ content, isDirty: () => true, onChange });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(DEFAULT_AUTO_SAVE_DEBOUNCE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange after debounce delay when content changes", () => {
    const content = ref(makeContent());
    const onChange = vi.fn();
    useAutoSave({
      content,
      isDirty: () => true,
      onChange,
      debounce: 500,
    });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses custom debounce interval", () => {
    const content = ref(makeContent());
    const onChange = vi.fn();
    useAutoSave({
      content,
      isDirty: () => true,
      onChange,
      debounce: 200,
    });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(199);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid changes into a single onChange call", () => {
    const content = ref(makeContent());
    const onChange = vi.fn();
    useAutoSave({
      content,
      isDirty: () => true,
      onChange,
      debounce: 500,
    });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(200);
    content.value.settings.width = 800;
    vi.advanceTimersByTime(200);
    content.value.settings.width = 900;
    vi.advanceTimersByTime(500);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onChange when isDirty returns false", () => {
    const content = ref(makeContent());
    const onChange = vi.fn();
    useAutoSave({
      content,
      isDirty: () => false,
      onChange,
      debounce: 100,
    });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("deep clones content passed to onChange", () => {
    const content = ref(makeContent());
    let received: TemplateContent | null = null;
    useAutoSave({
      content,
      isDirty: () => true,
      onChange: (c) => {
        received = c;
      },
      debounce: 100,
    });

    content.value.settings.width = 700;
    vi.advanceTimersByTime(100);
    expect(received).not.toBe(content.value);
    expect(received!.settings.width).toBe(700);
  });

  describe("flush", () => {
    it("immediately calls onChange when dirty", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { flush } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
      });

      flush();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("cancels pending debounced call", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { flush } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      flush();
      vi.advanceTimersByTime(500);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("does not call onChange when not dirty", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { flush } = useAutoSave({
        content,
        isDirty: () => false,
        onChange,
      });

      flush();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("cancels pending call without triggering onChange", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { cancel } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      cancel();
      vi.advanceTimersByTime(500);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("pause", () => {
    it("prevents auto-save from firing", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { pause } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
      });

      pause();
      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("cancels any pending save", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { pause } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      pause();
      vi.advanceTimersByTime(500);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    it("re-enables auto-save after pause", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { pause, resume } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
      });

      pause();
      resume();
      content.value.settings.width = 700;
      vi.advanceTimersByTime(100);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("enabled", () => {
    it("skips auto-save when enabled is false", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        enabled: false,
        debounce: 100,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("evaluates function form of enabled on each trigger", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      let enabledValue = false;
      useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        enabled: () => enabledValue,
        debounce: 100,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();

      enabledValue = true;
      content.value.settings.width = 800;
      vi.advanceTimersByTime(100);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("does not fire pending save when disabled during debounce window", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      let enabledValue = true;
      useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        enabled: () => enabledValue,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      enabledValue = false;
      vi.advanceTimersByTime(500);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not fire pending save when paused during debounce window", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { pause } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      pause();
      vi.advanceTimersByTime(500);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("stops watcher and cancels pending save", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { destroy } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 500,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      destroy();
      vi.advanceTimersByTime(500);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("content changes after destroy do not trigger save", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { destroy } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
      });

      destroy();
      content.value.settings.width = 700;
      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("double destroy is safe and leaves watcher stopped", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { destroy } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
      });
      destroy();
      destroy(); // second call must not throw
      content.value.settings.width = 999;
      vi.advanceTimersByTime(200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("flush after destroy still calls onChange if dirty", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      const { destroy, flush } = useAutoSave({
        content,
        isDirty: () => true,
        onChange,
      });
      destroy();
      flush();
      // flush calls onChange directly (bypasses watcher), so isDirty check still fires
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("error resilience", () => {
    it("onChange throwing does not break debounce cycle", () => {
      const content = ref(makeContent());
      const onChange = vi.fn().mockImplementationOnce(() => {
        throw new Error("save handler exploded");
      });
      useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
      });

      content.value.settings.width = 700;
      // The timeout callback will throw, but the watcher survives
      expect(() => vi.advanceTimersByTime(100)).toThrow("save handler exploded");
      expect(onChange).toHaveBeenCalledTimes(1);

      // Next change should still trigger
      content.value.settings.width = 800;
      vi.advanceTimersByTime(100);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("isDirty throwing propagates from the debounce timeout", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      useAutoSave({
        content,
        isDirty: () => {
          throw new Error("dirty check failed");
        },
        onChange,
        debounce: 100,
      });

      // isDirty is consulted at debounce time, not in the watcher — the change
      // itself is safe, and the error surfaces when the timeout fires.
      content.value.settings.width = 700;
      expect(onChange).not.toHaveBeenCalled();
      expect(() => vi.advanceTimersByTime(100)).toThrow("dirty check failed");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // The editor sets `state.isDirty = true` *after* mutating content, and the
  // reactivity watcher runs synchronously inside that mutation — so a dirty
  // check in the watcher observes the pre-mutation flag and drops the change
  // (issue #522). These wire the real editor rather than a constant `isDirty`,
  // which is what let that ship.
  describe("wired to the real editor", () => {
    function setup(debounce = 100) {
      const title = createTitleBlock();
      const content = makeContent();
      content.blocks.push(title);
      const editor = useEditor({ content });
      const onChange = vi.fn<(content: TemplateContent) => void>();
      const autoSave = useAutoSave({
        content: editor.content,
        isDirty: () => editor.state.isDirty,
        onChange,
        debounce,
      });
      return { editor, title, onChange, autoSave };
    }

    it("fires onChange on the first updateBlock", () => {
      const { editor, title, onChange } = setup();

      editor.updateBlock(title.id, { level: 3 });
      vi.advanceTimersByTime(100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].blocks[0]).toMatchObject({
        id: title.id,
        level: 3,
      });
    });

    it("fires onChange on the first updateSettings", () => {
      const { editor, onChange } = setup();

      editor.updateSettings({ width: 700 });
      vi.advanceTimersByTime(100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].settings.width).toBe(700);
    });

    it("fires onChange on the first addBlock", () => {
      const { editor, onChange } = setup();
      const block = createParagraphBlock();

      editor.addBlock(block);
      vi.advanceTimersByTime(100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].blocks).toHaveLength(2);
      expect(onChange.mock.calls[0][0].blocks[1].id).toBe(block.id);
    });

    it("fires onChange on the first removeBlock", () => {
      const { editor, title, onChange } = setup();

      editor.removeBlock(title.id);
      vi.advanceTimersByTime(100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].blocks).toHaveLength(0);
    });

    it("still collapses a burst of edits into one call", () => {
      const { editor, title, onChange } = setup();

      editor.updateBlock(title.id, { level: 3 });
      vi.advanceTimersByTime(50);
      editor.updateBlock(title.id, { level: 4 });
      vi.advanceTimersByTime(50);
      editor.updateBlock(title.id, { level: 5 });
      vi.advanceTimersByTime(100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].blocks[0]).toMatchObject({ level: 5 });
    });

    it("does not fire onChange for a non-dirtying setContent", () => {
      const { editor, onChange } = setup();

      editor.setContent(makeContent(), false);
      vi.advanceTimersByTime(100);

      expect(onChange).not.toHaveBeenCalled();
      expect(editor.state.isDirty).toBe(false);
    });
  });

  describe("driving a templates provider", () => {
    /**
     * How the editor package wires autosave: the debounced tick calls
     * `editor.save()`, which patches the consumer's provider. Covered here
     * because the interaction that matters — a save clears `isDirty`, and the
     * *next* edit must still schedule — lives across both modules.
     */
    function setup() {
      const title = createTitleBlock();
      const content = makeContent();
      content.blocks.push(title);
      // The stored copy carries the same block ids, since `load()` replaces the
      // editor's content with it — a stored template with different blocks would
      // make every `updateBlock` below a silent no-op.
      const template = {
        id: "tpl_1",
        content: JSON.parse(JSON.stringify(content)) as TemplateContent,
      };
      const save = vi.fn().mockResolvedValue(template);
      const editor = useEditor({
        content,
        templates: {
          load: vi.fn().mockResolvedValue(template),
          create: vi.fn().mockResolvedValue(template),
          save,
        },
      });
      const autoSave = useAutoSave({
        content: editor.content,
        isDirty: () => editor.state.isDirty,
        onChange: () => {
          void editor.save();
        },
        debounce: 100,
      });
      return { editor, title, save, autoSave, template };
    }

    it("saves through the provider after the debounce", async () => {
      const { editor, title, save } = setup();
      await editor.load("tpl_1");

      editor.updateBlock(title.id, { level: 3 });
      expect(save).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toBe("tpl_1");
      expect(save.mock.calls[0][1].content.blocks[0]).toMatchObject({
        id: title.id,
        level: 3,
      });
    });

    it("saves the first edit after a save cleared isDirty (#522)", async () => {
      const { editor, title, save } = setup();
      await editor.load("tpl_1");

      editor.updateBlock(title.id, { level: 3 });
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(editor.state.isDirty).toBe(false);

      editor.updateBlock(title.id, { level: 4 });
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][1].content.blocks[0]).toMatchObject({
        level: 4,
      });
    });

    it("does not save while paused for history navigation", () => {
      const { editor, title, save, autoSave } = setup();

      autoSave.pause();
      editor.updateBlock(title.id, { level: 3 });
      vi.advanceTimersByTime(100);

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("scheduleOnChange edge cases", () => {
    it("does not schedule when not enabled", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      useAutoSave({
        content,
        isDirty: () => true,
        onChange,
        debounce: 100,
        enabled: () => false,
      });

      content.value.settings.width = 700;
      vi.advanceTimersByTime(100);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not fire onChange when isDirty returns false at timeout", () => {
      const content = ref(makeContent());
      const onChange = vi.fn();
      let dirty = true;
      useAutoSave({
        content,
        isDirty: () => dirty,
        onChange,
        debounce: 100,
      });

      content.value.settings.width = 700;
      // isDirty becomes false before timeout fires
      dirty = false;
      vi.advanceTimersByTime(100);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
