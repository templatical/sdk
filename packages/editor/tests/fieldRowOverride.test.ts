// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  createImageBlock,
  createMenuBlock,
  createCountdownBlock,
  createSectionBlock,
  createCustomBlock,
  createButtonBlock,
  type Block,
} from "@templatical/types";
import { nextTick } from "vue";
import { mountEditor } from "./helpers/mount";
import FieldRow from "../src/components/toolbar/FieldRow.vue";
import { openLanguages, languageContent } from "./helpers/localization";

describe("field overrides", () => {
  it("resets Mobile inside a deleted ancestor while Desktop stays shown", async () => {
    const content = languageContent();
    content.blocks[1].visibility = { desktop: false, mobile: false };
    const { wrapper, editor, history } = await openLanguages({ content });
    editor.setActiveLocale("de");
    editor.selectBlock("image");
    editor.updateBlock("image", { visibility: undefined });
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    history.clear();
    await nextTick();
    await vi.dynamicImportSettled();
    const mobile = wrapper.get('[data-locale-path="visibility.mobile"]');
    const desktop = wrapper.get('[data-locale-path="visibility.desktop"]');
    expect(mobile.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
    expect(desktop.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );

    await mobile.get('[data-testid="field-reset"]').trigger("click");

    expect(mobile.get('[role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
    expect(desktop.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
    expect(mobile.find('[data-testid="field-locale-pill"]').exists()).toBe(
      false,
    );
    expect(desktop.find('[data-testid="field-locale-pill"]').exists()).toBe(
      true,
    );
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      "visibility.desktop": null,
    });
    history.undo();
    await nextTick();
    expect(mobile.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
    expect(desktop.get('[role="switch"]').attributes("aria-checked")).toBe(
      "true",
    );
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    expect(history.canUndo.value).toBe(false);
  });

  it("resets Mobile inside an ancestor override while preserving Desktop and undo", async () => {
    const { wrapper, editor, history } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("image");
    editor.updateBlock("image", {
      visibility: { desktop: false, mobile: false },
    });
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: { desktop: false, mobile: false },
    });
    history.clear();
    await nextTick();
    await vi.dynamicImportSettled();
    const reset = vi.spyOn(editor, "resetLocaleFields");
    await wrapper
      .get('[data-locale-path="visibility.mobile"] [data-testid="field-reset"]')
      .trigger("click");
    expect(reset).toHaveBeenCalledWith("image", ["visibility.mobile"]);
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: { desktop: false },
    });
    expect(
      wrapper
        .get(
          '[data-locale-path="visibility.desktop"] [data-testid="field-locale-pill"]',
        )
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-locale-path="visibility.mobile"] [data-testid="field-locale-pill"]',
        )
        .exists(),
    ).toBe(false);
    history.undo();
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: { desktop: false, mobile: false },
    });
    expect(history.canUndo.value).toBe(false);
  });

  it("shows a language pill and emits reset without changing its input", async () => {
    const wrapper = mountEditor(FieldRow, {
      props: { label: "Color", overridden: true } as any,
      slots: { default: '<input value="red">' },
    });
    expect(wrapper.find('[data-testid="field-locale-pill"]').exists()).toBe(
      true,
    );
    await wrapper.get('[data-testid="field-reset"]').trigger("click");
    expect(wrapper.emitted("reset")).toHaveLength(1);
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "red",
    );
    await wrapper.setProps({ overridden: false });
    expect(wrapper.find('[data-testid="field-reset"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it("resets one toolbar property using the base layer while keeping text", async () => {
    const { wrapper, editor, history } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("title");
    await nextTick();
    await vi.dynamicImportSettled();
    const row = wrapper.get('[data-locale-path="color"]');
    expect(row.find('[data-testid="field-locale-pill"]').exists()).toBe(true);
    await row.get('[data-testid="field-reset"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.set).toBeUndefined();
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
    history.undo();
    expect(editor.content.value.blocks[0].l10n?.de.set?.color).toBe("#123456");
  });
  it.each([
    "direction",
    "fontFamily",
    "backgroundColor",
    "textColor",
    "linkColor",
    "preheaderText",
  ])("marks and resets the settings field %s", async (path) => {
    const content = languageContent();
    content.settings.l10n = {
      de: { set: { [path]: path === "direction" ? "rtl" : "different" } },
    };
    const { wrapper, editor, history } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    await vi.dynamicImportSettled();
    await wrapper.get("#tpl-tab-settings").trigger("click");
    await vi.dynamicImportSettled();
    const row = wrapper.get(`[data-locale-path="settings/${path}"]`);
    expect(row.get('[data-testid="field-locale-pill"]').text()).toBe("Deutsch");
    await row.get('[data-testid="field-reset"]').trigger("click");
    expect(editor.content.value.settings.l10n).toBeUndefined();
    history.undo();
    expect(editor.content.value.settings.l10n?.de.set?.[path]).toBeDefined();
  });
  it("marks translated toolbar text and resets only that path", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("image");
    editor.updateBlock("image", { alt: "Produkt" } as any);
    await nextTick();
    await vi.dynamicImportSettled();
    await wrapper
      .get('[data-locale-path="alt"] [data-testid="field-reset"]')
      .trigger("click");
    expect(editor.content.value.blocks[1].l10n).toBeUndefined();
  });
});

describe("composite and list field overrides", () => {
  it.each([
    [
      "custom text",
      () =>
        createCustomBlock({
          type: "card",
          name: "Card",
          fields: [
            {
              key: "title",
              label: "Title",
              type: "text",
              default: "Hello",
            },
          ],
          template: "<mj-text>{{ title }}</mj-text>",
        } as any),
      "fieldValues.title",
      "Hallo",
    ],
    [
      "image link target",
      () => createImageBlock({ linkUrl: "https://example.com" }),
      "linkOpenInNewTab",
      true,
    ],
    ["image width", () => createImageBlock(), "width", 250],
    ["image decorative", () => createImageBlock(), "decorative", true],
    ["button width", () => createButtonBlock(), "width", 250],
    [
      "button new tab",
      () => createButtonBlock({ url: "https://example.com" }),
      "openInNewTab",
      true,
    ],
    [
      "menu text",
      () =>
        createMenuBlock({
          items: [{ id: "item", text: "Hello", url: "" }] as any,
        }),
      "items.item.text",
      "Hallo",
    ],
    [
      "menu url",
      () =>
        createMenuBlock({
          items: [{ id: "item", text: "Hello", url: "" }] as any,
        }),
      "items.item.url",
      "https://example.de",
    ],
    ["countdown label", () => createCountdownBlock(), "labelDays", "Tage"],
    ["countdown display", () => createCountdownBlock(), "showDays", false],
    ["common padding", () => createImageBlock(), "styles.padding.top", 30],
    ["common visibility", () => createImageBlock(), "visibility.mobile", false],
    [
      "wrapper image",
      () => createSectionBlock({ wrapper: { backgroundColor: "#ffffff" } }),
      "wrapper.backgroundImage",
      "https://example.de/bg.jpg",
    ],
  ] as const)(
    "resets the %s override at its own control",
    async (_name, factory, path, value) => {
      const content = languageContent();
      const block = factory() as Block;
      block.id = "field";
      block.l10n = { de: { set: { [path]: value } } };
      content.blocks = [block];
      const { wrapper, editor } = await openLanguages({
        content,
        customBlocks: [
          {
            type: "card",
            name: "Card",
            fields: [
              {
                key: "title",
                label: "Title",
                type: "text",
                default: "Hello",
              },
            ],
            template: "<mj-text>{{ title }}</mj-text>",
          } as any,
        ],
      });
      editor.setActiveLocale("de");
      editor.selectBlock("field");
      await nextTick();
      await vi.dynamicImportSettled();
      const row = wrapper.findAll("[data-locale-path]").find((row) => {
        const rowPath = row.attributes("data-locale-path");
        return path === rowPath || path.startsWith(`${rowPath}.`);
      });
      expect(row, `field ${path} is reachable`).toBeDefined();
      await row!.get('[data-testid="field-reset"]').trigger("click");
      expect(editor.content.value.blocks[0].l10n).toBeUndefined();
    },
  );
});
