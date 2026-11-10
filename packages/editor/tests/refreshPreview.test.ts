// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { createDefaultTemplateContent, type TemplateContent } from "@templatical/types";
import Editor from "../src/Editor.vue";
import { init, type TemplaticalEditor } from "../src/index";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

const wrappers: VueWrapper[] = [];
const handles: TemplaticalEditor[] = [];

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  for (const handle of handles.splice(0)) handle.unmount();
  document.body.innerHTML = "";
});

async function realEditor(config: Record<string, unknown> = {}) {
  const wrapper = mount(Editor, {
    attachTo: document.body,
    props: {
      config: {
        container: document.createElement("div"),
        content: createDefaultTemplateContent(),
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  wrappers.push(wrapper);
  return wrapper;
}

async function publicEditor(config: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const handle = await init({
    container,
    shadowDom: false,
    content: createDefaultTemplateContent(),
    ...config,
  });
  handles.push(handle);
  return { handle, container };
}

describe("Refresh preview surfaces", () => {
  it("renders a labelled preview pill only with a resolver and refreshes immediately", async () => {
    const content = createDefaultTemplateContent();
    const resolver = vi.fn(async () => content);
    const wrapper = await realEditor({ content, resolvePreview: resolver });
    expect(wrapper.find('[data-testid="refresh-preview"]').exists()).toBe(false);
    await wrapper.find(".tpl-preview-toggle").trigger("click");
    const button = wrapper.find('[data-testid="refresh-preview"]');
    expect(button.text().trim()).toBe("Refresh preview");
    expect(button.attributes("title")).toBe("Refresh preview");
    await button.trigger("click");
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(resolver.mock.calls[1]![0]).toEqual({ content, trigger: "refresh" });

    const without = await realEditor();
    await without.find(".tpl-preview-toggle").trigger("click");
    expect(without.find('[data-testid="refresh-preview"]').exists()).toBe(false);
  });

  it("keeps the preview pill busy during refresh and enabled for a newer click", async () => {
    const content = createDefaultTemplateContent();
    let settle: ((value: TemplateContent) => void) | undefined;
    const resolver = vi.fn().mockResolvedValueOnce(content).mockImplementationOnce(
      () => new Promise<TemplateContent>((resolve) => { settle = resolve; }),
    );
    const wrapper = await realEditor({ content, resolvePreview: resolver });
    await wrapper.find(".tpl-preview-toggle").trigger("click");
    await flushPromises();
    const button = wrapper.find('[data-testid="refresh-preview"]');
    await button.trigger("click");
    expect(button.attributes("aria-busy")).toBe("true");
    expect((button.element as HTMLButtonElement).disabled).toBe(false);
    settle!(content);
    await flushPromises();
    expect(button.attributes("aria-busy")).not.toBe("true");
  });
});

describe("refreshPreview() public instance", () => {
  it("does nothing outside a preview, without a resolver, and after unmount", async () => {
    const resolver = vi.fn(async ({ content }: { content: TemplateContent }) => content);
    const { handle, container } = await publicEditor({ resolvePreview: resolver });
    handle.refreshPreview();
    expect(resolver).toHaveBeenCalledTimes(0);
    container.querySelector<HTMLButtonElement>(".tpl-preview-toggle")!.click();
    await nextTick();
    expect(resolver).toHaveBeenCalledTimes(1);
    handle.unmount();
    handle.refreshPreview();
    expect(resolver).toHaveBeenCalledTimes(1);

    const noResolver = await publicEditor();
    noResolver.handle.refreshPreview();
    expect(noResolver.container.querySelector('[data-testid="refresh-preview"]')).toBeNull();
  });

  it("targets preview mode, then only the dialog when it is open over preview mode", async () => {
    const resolver = vi.fn(async ({ content }: { content: TemplateContent }) => content);
    const { handle, container } = await publicEditor({
      resolvePreview: resolver,
      testEmail: {
        send: vi.fn(async () => {}),
        defaultRecipient: "guest@example.com",
      },
    });
    container.querySelector<HTMLButtonElement>(".tpl-preview-toggle")!.click();
    await nextTick();
    resolver.mockClear();
    handle.refreshPreview();
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver.mock.calls[0]![0]).toEqual({
      content: handle.getContent(), trigger: "refresh",
    });

    container.querySelector<HTMLButtonElement>('[data-testid="test-email-trigger"]')!.click();
    await flushPromises();
    await nextTick();
    await flushPromises();
    await vi.waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });
    resolver.mockClear();
    handle.refreshPreview();
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver.mock.calls[0]![0]).toEqual({
      content: handle.getContent(), recipient: "guest@example.com", trigger: "refresh",
    });
  });
});
