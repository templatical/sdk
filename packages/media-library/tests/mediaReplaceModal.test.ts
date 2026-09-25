// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset } from "@templatical/types";
import MediaReplaceModal from "../src/components/media/MediaReplaceModal.vue";

function createAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "hero",
    url: "https://cdn.example.com/hero.jpg",
    filename: "hero.jpg",
    mimeType: "image/jpeg",
    size: 2048,
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

function buttonByText(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!match) {
    throw new Error(`button "${label}" not found`);
  }
  return match;
}

function mountReplace(
  overrides: {
    item?: MediaAsset | null;
    visible?: boolean;
    usageInfo?: { templateCount: number; templateNames: string[] } | null;
    isReplacing?: boolean;
    error?: string | null;
  } = {},
): VueWrapper {
  const wrapper = mount(MediaReplaceModal, {
    props: {
      visible: overrides.visible ?? true,
      item: overrides.item === undefined ? createAsset() : overrides.item,
      usageInfo: overrides.usageInfo ?? null,
      isReplacing: overrides.isReplacing ?? false,
      error: overrides.error ?? null,
    },
    attachTo: document.body,
    global: {
      stubs: {
        Transition: {
          inheritAttrs: false,
          setup(
            _props: unknown,
            { slots }: { slots: { default?: () => unknown } },
          ) {
            return () => slots.default?.();
          },
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
});

describe("MediaReplaceModal", () => {
  it("keeps Replace disabled until a file is chosen, then emits that file", async () => {
    const wrapper = mountReplace();
    await flushPromises();

    const replace = buttonByText("Replace");
    expect(replace.disabled).toBe(true);

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe(".jpg");

    const file = new File(["bytes"], "hero.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: { 0: file, length: 1 } });
    await input.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    expect(replace.disabled).toBe(false);
    replace.click();
    await flushPromises();
    expect(wrapper.emitted("replace")).toEqual([[file]]);
  });

  it("names the required extension from a filename without one as *", async () => {
    mountReplace({
      item: createAsset({ filename: "hero" }),
    });
    await flushPromises();
    expect(
      document.querySelector<HTMLInputElement>('input[type="file"]')!.accept,
    ).toBe("*");
  });

  it("warns when the file is used in templates", async () => {
    mountReplace({
      usageInfo: { templateCount: 3, templateNames: ["Welcome"] },
    });
    await flushPromises();
    expect(document.body.textContent).toContain("3");
    expect(document.body.textContent).toContain("template");
  });

  it("surfaces a replace error on the file input", async () => {
    mountReplace({ error: "too large" });
    await flushPromises();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "tpl-media-replace-error",
    );
    expect(
      document.querySelector("#tpl-media-replace-error")?.textContent,
    ).toContain("too large");
  });

  it("closes on Escape and Cancel", async () => {
    const wrapper = mountReplace();
    await flushPromises();

    document
      .querySelector('[role="dialog"]')!
      .parentElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);

    buttonByText("Cancel").click();
    expect(wrapper.emitted("close")!.length).toBe(2);
  });

  it("clears the chosen file when the dialog closes", async () => {
    const wrapper = mountReplace();
    await flushPromises();

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["bytes"], "hero.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", {
      value: { 0: file, length: 1 },
      configurable: true,
    });
    await input.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    expect(buttonByText("Replace").disabled).toBe(false);

    await wrapper.setProps({ visible: false });
    await flushPromises();
    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(buttonByText("Replace").disabled).toBe(true);
  });
});
