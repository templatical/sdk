// @vitest-environment happy-dom
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { createDefaultTemplateContent } from "@templatical/types";
import { init, type TemplaticalEditor } from "../src/index";
import * as i18n from "../src/i18n";

const mounted: Array<{ editor: TemplaticalEditor; container: HTMLElement }> =
  [];

afterEach(() => {
  for (const { editor, container } of mounted.splice(0)) {
    editor.unmount();
    container.remove();
  }
});

async function open(shadowDom: boolean, header: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const editor = await init({
    container,
    shadowDom,
    content: createDefaultTemplateContent(),
    header,
    testEmail: { send: vi.fn(async () => {}) },
    templates: {
      load: vi.fn(async (id: string) => ({
        id,
        content: createDefaultTemplateContent(),
      })),
      create: vi.fn(async () => ({
        id: "tpl_1",
        content: createDefaultTemplateContent(),
      })),
      save: vi.fn(async (id: string) => ({
        id,
        content: createDefaultTemplateContent(),
      })),
    },
  });
  mounted.push({ editor, container });
  await editor.create({ name: "Header" });
  await nextTick();
  return { editor, container, root: container.shadowRoot ?? container };
}

describe.each([true, false])(
  "header actions with shadowDom=%s",
  (shadowDom) => {
    it("places the owned element before Test and Save", async () => {
      const actions = document.createElement("div");
      actions.id = "host-actions";
      actions.innerHTML = '<button type="button">Template</button>';
      const { container, root } = await open(shadowDom, { actions });
      const right = root.querySelector(".tpl-header-right")!;
      const hostButton = actions.querySelector("button")!;
      const testButton = right.querySelector(
        '[data-testid="test-email-trigger"]',
      )!;
      const saveButton = right.querySelector('[data-testid="template-save"]')!;
      expect(actions.contains(hostButton)).toBe(true);
      expect(hostButton.textContent).toBe("Template");
      let marker: Element;
      if (shadowDom) {
        expect(actions.parentElement).toBe(container);
        expect(actions.slot).toBe("tpl-header-actions");
        marker = right.querySelector('slot[name="tpl-header-actions"]')!;
      } else {
        expect(
          actions.parentElement?.classList.contains("tpl-header-actions"),
        ).toBe(true);
        marker = actions.parentElement!;
      }
      const children = Array.from(right.children);
      expect(children.indexOf(marker)).toBeGreaterThan(-1);
      expect(children.indexOf(marker)).toBeLessThan(
        children.indexOf(testButton),
      );
      expect(children.indexOf(marker)).toBeLessThan(
        children.indexOf(saveButton),
      );
    });

    it("forwards init header opt-outs to the real editor and freezes them for the session", async () => {
      const header = reactive({
        actions: document.createElement("span"),
        darkModeToggle: false,
        previewToggle: false,
        viewportToggle: false,
      });
      const { root } = await open(shadowDom, header);
      const center = root.querySelector(".tpl-header-center")!;
      expect(center.children).toHaveLength(0);
      header.darkModeToggle = true;
      header.previewToggle = true;
      header.viewportToggle = true;
      await nextTick();
      expect(center.children).toHaveLength(0);
    });

    it("writes compact and resolved theme attributes and restores its old slot on unmount", async () => {
      const actions = document.createElement("span");
      actions.slot = "old-slot";
      const { editor, container } = await open(shadowDom, { actions });
      expect(actions.getAttribute("data-tpl-compact")).toBe("false");
      expect(actions.getAttribute("data-tpl-theme")).toBe("light");
      editor.setTheme("dark");
      await nextTick();
      expect(actions.getAttribute("data-tpl-theme")).toBe("dark");
      editor.unmount();
      expect(actions.isConnected).toBe(false);
      expect(actions.parentElement).toBeNull();
      expect(actions.slot).toBe("old-slot");
      expect(container.querySelector("[slot='tpl-header-actions']")).toBeNull();
    });

    it("remeasures when host content changes without listening to its own attributes", async () => {
      const actions = document.createElement("span");
      actions.innerHTML = "<span hidden>short</span>";
      const original = HTMLElement.prototype.getBoundingClientRect;
      const rect = (width: number) =>
        ({
          width,
          left: 0,
          right: width,
          top: 0,
          bottom: 20,
          x: 0,
          y: 0,
          height: 20,
          toJSON() {},
        }) as DOMRect;
      const boxes = vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          if (this.classList.contains("tpl-header-container"))
            return rect(1200);
          if (this.classList.contains("tpl-header-left")) return rect(100);
          if (this.classList.contains("tpl-header-center")) return rect(300);
          if (this.classList.contains("tpl-header-right")) return rect(100);
          return original.call(this);
        });
      onTestFinished(() => boxes.mockRestore());
      const { root } = await open(shadowDom, { actions });
      const header = root.querySelector(".tpl-header")!;
      await vi.waitFor(() =>
        expect(Number(header.getAttribute("data-full-width"))).toBeGreaterThan(
          0,
        ),
      );
      for (let frame = 0; frame < 4; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      let fullReads = 0;
      Object.defineProperty(actions, "getBoundingClientRect", {
        configurable: true,
        value: () => {
          if (!actions.hasAttribute("data-tpl-compact")) fullReads++;
          return original.call(actions);
        },
      });
      onTestFinished(() =>
        Reflect.deleteProperty(actions, "getBoundingClientRect"),
      );
      for (let frame = 0; frame < 2; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      expect(fullReads).toBe(0);
      actions.firstElementChild!.textContent = "A longer hidden label";
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      for (let frame = 0; frame < 2; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      expect(fullReads).toBeGreaterThan(0);
      for (let frame = 0; frame < 3; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      fullReads = 0;
      actions.setAttribute("data-tpl-compact", "true");
      actions.setAttribute("data-tpl-theme", "dark");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      expect(fullReads).toBe(0);
    });

    it("does not append an element from a superseded init call", async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      let release!: (
        value: Awaited<ReturnType<typeof i18n.loadTranslations>>,
      ) => void;
      const held = new Promise<
        Awaited<ReturnType<typeof i18n.loadTranslations>>
      >((resolve) => {
        release = resolve;
      });
      const original = i18n.loadTranslations;
      const load = vi
        .spyOn(i18n, "loadTranslations")
        .mockImplementationOnce(() => held)
        .mockImplementation(original);
      onTestFinished(() => load.mockRestore());
      const staleActions = document.createElement("span");
      const currentActions = document.createElement("span");
      const first = init({
        container,
        shadowDom,
        header: { actions: staleActions },
      });
      const second = await init({
        container,
        shadowDom,
        header: { actions: currentActions },
      });
      mounted.push({ editor: second, container });
      release(await original("en"));
      const superseded = await first;
      mounted.push({ editor: superseded, container });
      expect(staleActions.isConnected).toBe(false);
      expect(currentActions.isConnected).toBe(true);
      superseded.unmount();
      expect(currentActions.isConnected).toBe(true);
    });
  },
);
