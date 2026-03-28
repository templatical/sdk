import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref } from "@vue/reactivity";
import type { TemplateContent } from "@templatical/types";
import { createDefaultTemplateContent } from "@templatical/types";
import { useAutoSave } from "../src/auto-save";

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

    it("isDirty throwing propagates from watcher", () => {
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

      // isDirty is called inside the watcher — error propagates synchronously
      expect(() => {
        content.value.settings.width = 700;
      }).toThrow("dirty check failed");
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
