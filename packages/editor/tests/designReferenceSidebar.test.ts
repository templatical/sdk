// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import {
  EDITOR_KEY,
  AUTH_MANAGER_KEY,
  CLOUD_TRANSLATIONS_KEY,
} from "../src/keys";

// Mock the cloud composable to avoid touching API/auth.
vi.mock("@templatical/core/cloud", () => ({
  useDesignReference: () => ({
    error: ref<string | null>(null),
    isGenerating: ref(false),
    generate: vi.fn(),
  }),
}));

import DesignReferenceSidebar from "../src/cloud/components/DesignReferenceSidebar.vue";

const cloudTranslationsStub = {
  designReference: {
    title: "Design",
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
    createObjectURL = vi.fn(
      (file: File) => `blob:fake/${file.name}`,
    );
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mountSidebar() {
    return mount(DesignReferenceSidebar, {
      props: { visible: true, hasExistingBlocks: false },
      global: {
        provide: {
          [EDITOR_KEY as symbol]: editorStub,
          [AUTH_MANAGER_KEY as symbol]: authManagerStub,
          [CLOUD_TRANSLATIONS_KEY as symbol]: cloudTranslationsStub,
        },
      },
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
});
