// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import {
  EDITOR_KEY,
  AUTH_MANAGER_KEY,
  CLOUD_TRANSLATIONS_KEY,
} from "../src/keys";
import { MAX_UPLOAD_SIZE_BYTES } from "../src/constants/timeouts";

const { design } = vi.hoisted(() => {
  const { ref } = require("vue") as typeof import("vue");
  return {
    design: {
      error: ref<string | null>(null),
      isGenerating: ref(false),
      generate: vi.fn(),
    },
  };
});

vi.mock("@templatical/core/cloud", () => ({
  useDesignReference: () => design,
}));

import DesignReferenceSidebar from "../src/cloud/components/DesignReferenceSidebar.vue";

const cloudTranslationsStub = {
  designReference: {
    title: "Design",
    close: "Close",
    uploadImage: "Image",
    uploadPdf: "PDF",
    dropHint: "Drop file",
    acceptedImages: "PNG, JPG, WEBP",
    acceptedPdf: "PDF",
    promptLabel: "Prompt",
    promptPlaceholder: "Describe…",
    generating: "Generating…",
    fileTooLarge: "Too large",
    invalidFileType: "Invalid type",
    error: "Error",
    generate: "Generate",
    replaceWarning: "Existing blocks will be replaced",
    replaceCancel: "Cancel",
    replaceConfirm: "Replace",
  },
  aiMenu: { disclaimer: "AI disclaimer" },
} as any;

const editorStub = {
  state: { template: { id: "tpl-1" } },
} as any;

const authManagerStub = {} as any;

describe("DesignReferenceSidebar", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn((file: File) => `blob:fake/${file.name}`);
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    design.error.value = null;
    design.isGenerating.value = false;
    design.generate.mockClear();
  });

  function mountSidebar(hasExistingBlocks = false) {
    return mount(DesignReferenceSidebar, {
      props: { visible: true, hasExistingBlocks },
      global: {
        provide: {
          [EDITOR_KEY as symbol]: editorStub,
          [AUTH_MANAGER_KEY as symbol]: authManagerStub,
          [CLOUD_TRANSLATIONS_KEY as symbol]: cloudTranslationsStub,
        },
        stubs: { Transition: false },
      },
    });
  }

  async function dropFile(
    wrapper: ReturnType<typeof mountSidebar>,
    file: File,
  ) {
    await wrapper.find(".tpl-design-dropzone").trigger("drop", {
      dataTransfer: { files: [file] },
    });
  }

  it("revokes the blob URL on unmount when a file preview is active", async () => {
    const wrapper = mountSidebar();

    // Simulate dropping an image file. handleDrop reads dataTransfer.files,
    // validates, and calls URL.createObjectURL.
    const file = new File(["fake-img"], "design.png", { type: "image/png" });
    const dropZone = wrapper.find(".tpl-design-dropzone");
    expect(dropZone.exists()).toBe(true);

    await dropZone.trigger("drop", {
      dataTransfer: { files: [file] },
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    // Unmount without manually clearing the file. The leak is: blob URL
    // stays allocated forever. Fix must call revokeObjectURL on teardown.
    wrapper.unmount();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake/design.png");
  });

  it("does not call revokeObjectURL on unmount when no file was selected", () => {
    const wrapper = mountSidebar();
    wrapper.unmount();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("rejects an oversized file and an image on the PDF tab", async () => {
    const wrapper = mountSidebar();
    const huge = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: MAX_UPLOAD_SIZE_BYTES + 1 });
    await dropFile(wrapper, huge);
    expect(design.error.value).toBe("Too large");
    expect(wrapper.text()).toContain("Error");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("PDF"))!
      .trigger("click");
    const png = new File(["x"], "shot.png", { type: "image/png" });
    await dropFile(wrapper, png);
    expect(design.error.value).toBe("Invalid type");
  });

  it("generates from an image plus prompt, and asks first when the canvas has blocks", async () => {
    const empty = mountSidebar(false);
    const file = new File(["img"], "design.png", { type: "image/png" });
    await dropFile(empty, file);
    await empty.find("textarea").setValue("  make it warm  ");
    await empty
      .findAll("button")
      .find((b) => b.text().includes("Generate"))!
      .trigger("click");
    expect(design.generate).toHaveBeenCalledWith({
      prompt: "make it warm",
      imageUpload: file,
    });
    empty.unmount();
    design.generate.mockClear();

    const occupied = mountSidebar(true);
    const pdf = new File(["p"], "ref.pdf", { type: "application/pdf" });
    await occupied
      .findAll("button")
      .find((b) => b.text().includes("PDF"))!
      .trigger("click");
    await dropFile(occupied, pdf);
    await occupied
      .findAll("button")
      .find((b) => b.text().includes("Generate"))!
      .trigger("click");
    expect(design.generate).not.toHaveBeenCalled();
    expect(occupied.text()).toContain("Existing blocks will be replaced");

    await occupied
      .findAll("button")
      .find((b) => b.text() === "Replace")!
      .trigger("click");
    expect(design.generate).toHaveBeenCalledWith({ pdfUpload: pdf });
  });

  it("closes from the header", async () => {
    const wrapper = mountSidebar();
    await wrapper.get('button[aria-label="Close"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
