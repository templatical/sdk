// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";

// Capture the onDrop handler useImageDrop hands to useDropZone, and drive it
// directly — this exercises our filter/single-file/enabled logic without
// depending on the DOM drag-and-drop pipeline.
const captured: { onDrop?: (files: File[] | null) => void } = {};
const isOverDropZone = ref(false);

vi.mock("@vueuse/core", () => ({
  useDropZone: vi.fn((_target, opts) => {
    captured.onDrop = opts.onDrop;
    return { isOverDropZone, files: ref(null) };
  }),
}));

import { useImageDrop } from "../src/composables/useImageDrop";

function imageFile(name = "a.png", type = "image/png"): File {
  return new File(["data"], name, { type });
}

describe("useImageDrop", () => {
  beforeEach(() => {
    captured.onDrop = undefined;
    isOverDropZone.value = false;
  });

  it("forwards a single dropped image to onFiles", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles });
    const img = imageFile();
    captured.onDrop!([img]);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith([img]);
  });

  it("filters out non-image files (no call)", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles });
    captured.onDrop!([new File(["x"], "a.txt", { type: "text/plain" })]);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("reduces a multi-image drop to the first image", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles });
    const first = imageFile("first.png");
    const second = imageFile("second.jpg", "image/jpeg");
    captured.onDrop!([first, second]);
    expect(onFiles).toHaveBeenCalledWith([first]);
  });

  it("keeps the first image when mixed with a non-image", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles });
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    const img = imageFile("b.png");
    captured.onDrop!([txt, img]);
    expect(onFiles).toHaveBeenCalledWith([img]);
  });

  it("ignores an empty/null drop", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles });
    captured.onDrop!(null);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("ignores drops while disabled", () => {
    const onFiles = vi.fn();
    useImageDrop({ target: ref(null), onFiles, enabled: ref(false) });
    captured.onDrop!([imageFile()]);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("isOver is false when disabled even while hovering", () => {
    isOverDropZone.value = true;
    const { isOver } = useImageDrop({
      target: ref(null),
      onFiles: vi.fn(),
      enabled: ref(false),
    });
    expect(isOver.value).toBe(false);
  });

  it("isOver tracks the drop-zone hover state when enabled", () => {
    const { isOver } = useImageDrop({
      target: ref(null),
      onFiles: vi.fn(),
      enabled: ref(true),
    });
    expect(isOver.value).toBe(false);
    isOverDropZone.value = true;
    expect(isOver.value).toBe(true);
  });
});
