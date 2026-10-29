// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { openLanguages } from "./helpers/localization";

describe("field language controls", () => {
  it("shows a Deutsch pill and icon-only Reset to English, resetting one field with undo", async () => {
    const { wrapper, editor, history } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("title");
    await nextTick();
    await vi.dynamicImportSettled();
    const row = wrapper.get('[data-locale-path="color"]');
    expect(row.get('[data-testid="field-locale-pill"]').text()).toBe("Deutsch");
    expect(row.find('[data-testid="field-override-dot"]').exists()).toBe(false);
    const reset = row.get('[data-testid="field-reset"]');
    expect(reset.attributes("title")).toBe("Reset to English");
    expect(reset.attributes("aria-label")).toBe("Reset to English");
    expect(reset.text()).toBe("");
    await reset.trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.set).toBeUndefined();
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
    expect(row.find('[data-testid="field-locale-pill"]').exists()).toBe(false);
    history.undo();
    expect(editor.content.value.blocks[0].l10n?.de.set?.color).toBe("#123456");
  });
});
