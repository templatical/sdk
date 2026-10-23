// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createDefaultTemplateContent } from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { SIZE_CHECK_KEY, type SizeCheckContext } from "../src/keys";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

async function sizeContext(
  config: Record<string, unknown> = {},
  callbacks: Record<string, unknown> = {},
): Promise<SizeCheckContext> {
  wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: createDefaultTemplateContent(),
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
      ...callbacks,
    } as never,
    global: { stubs: { teleport: true } },
  });
  return (wrapper.vm.$.provides as Record<symbol, SizeCheckContext>)[
    SIZE_CHECK_KEY as symbol
  ];
}

describe("Editor HTML size context", () => {
  it("reports unavailable HTML rendering for a direct mount", async () => {
    const context = await sizeContext();
    expect(context.canRenderHtml()).toBe(false);
    expect(context.cloud).toBe(false);
    expect(context.options).toEqual({});
    await expect(context.renderHtml()).rejects.toThrow(
      "HTML rendering is unavailable",
    );
  });

  it("passes entry rendering callbacks and lint options to descendants", async () => {
    const renderHtml = vi.fn(async () => "<html>ready</html>");
    const canRenderHtml = vi.fn(() => true);
    const context = await sizeContext(
      { lint: { locale: "de" } },
      { renderHtml, canRenderHtml },
    );
    expect(context.canRenderHtml()).toBe(true);
    await expect(context.renderHtml()).resolves.toBe("<html>ready</html>");
    expect(renderHtml).toHaveBeenCalledTimes(1);
    expect(canRenderHtml).toHaveBeenCalledTimes(1);
    expect(context.options).toEqual({ locale: "de" });
  });
});
