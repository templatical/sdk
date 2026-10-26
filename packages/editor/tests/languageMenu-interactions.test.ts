// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { useEditor } from "@templatical/core";
import LanguageMenu from "../src/components/localization/LanguageMenu.vue";
import TplModal from "../src/components/TplModal.vue";
import en from "../src/i18n/locales/en";
import { POPOVER_ROOT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import { languageContent } from "./helpers/localization";

const wrappers: ReturnType<typeof mountEditor>[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

function openMenu() {
  const editor = useEditor({
    content: languageContent(),
    localization: { locales: ["de", "nl"] },
  });
  const wrapper = mountEditor(LanguageMenu, {
    props: { editor, locales: ["de", "nl"] },
    attachTo: document.body,
    provides: {
      [TRANSLATIONS_KEY]: en,
      [POPOVER_ROOT_KEY]: ref(document.body),
    },
    global: { stubs: { teleport: true } },
  });
  wrappers.push(wrapper);
  return {
    editor,
    wrapper,
    trigger: wrapper.get('[data-testid="language-menu"]'),
  };
}

describe("language menu interactions", () => {
  it("focuses the default row and wraps Arrow, Home and End navigation without selecting", async () => {
    const { wrapper, editor, trigger } = openMenu();
    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll('[role^="menuitem"]');
    expect(document.activeElement).toBe(items[0].element);
    await items[0].trigger("keydown", { key: "ArrowUp" });
    expect(document.activeElement).toBe(items.at(-1)!.element);
    await items.at(-1)!.trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0].element);
    await items[0].trigger("keydown", { key: "End" });
    expect(document.activeElement).toBe(items.at(-1)!.element);
    await items.at(-1)!.trigger("keydown", { key: "Home" });
    expect(document.activeElement).toBe(items[0].element);
    await items[0].trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(items[0].element);
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(editor.activeLocale.value).toBeNull();
  });

  it("dismisses with Escape, prevents its default and restores trigger focus", async () => {
    const { wrapper, trigger } = openMenu();
    await trigger.trigger("click");
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    wrapper
      .get('[data-testid="language-option-de"]')
      .element.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger.element);
  });

  it("dismisses outside clicks without changing the selected language", async () => {
    const { wrapper, editor, trigger } = openMenu();
    await trigger.trigger("click");
    // VueUse suppresses duplicate clicks until the next event-loop turn.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    outside.dispatchEvent(
      new MouseEvent("click", { bubbles: true, detail: 1 }),
    );
    await nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(editor.activeLocale.value).toBeNull();
    outside.remove();
  });

  it("cancels removal from both the cancel button and modal dismissal, then confirms it", async () => {
    const { wrapper, editor, trigger } = openMenu();
    await trigger.trigger("click");
    const before = JSON.stringify(editor.content.value);
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Deutsch");
    await wrapper
      .get('[data-testid="language-remove-cancel"]')
      .trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(JSON.stringify(editor.content.value)).toBe(before);
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    wrapper.getComponent(TplModal).vm.$emit("close");
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(JSON.stringify(editor.content.value)).toBe(before);
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    await wrapper
      .get('[data-testid="language-remove-confirm"]')
      .trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["fr"]);
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger.element);
  });

  it("keeps disabled versions selectable for reading and hides every mutation row in that view", async () => {
    const { wrapper, editor, trigger } = openMenu();
    await trigger.trigger("click");
    const french = wrapper.get('[data-testid="language-option-fr"]');
    expect(french.text()).toContain("Not enabled");
    expect(french.attributes("disabled")).toBeUndefined();
    expect(wrapper.find('[data-testid="language-remove-fr"]').exists()).toBe(
      false,
    );
    await french.trigger("click");
    expect(editor.activeLocale.value).toBe("fr");
    await trigger.trigger("click");
    expect(
      wrapper
        .get('[data-testid="language-option-fr"]')
        .attributes("aria-checked"),
    ).toBe("true");
    expect(wrapper.findAll('[data-testid^="language-add-"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid^="language-remove-"]')).toHaveLength(
      0,
    );
    await wrapper.get('[data-testid="language-option-en"]').trigger("click");
    expect(editor.activeLocale.value).toBeNull();
    await trigger.trigger("click");
    expect(wrapper.find('[data-testid="language-add-nl"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="language-remove-de"]').exists()).toBe(
      true,
    );
  });
});
