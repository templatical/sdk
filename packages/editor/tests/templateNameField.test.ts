// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import TemplateNameField from "../src/components/TemplateNameField.vue";
import { mountEditor } from "./helpers/mount";

/**
 * The header's inline rename. Every rule here is a decision from the design note:
 * click to edit, Enter commits, Escape cancels, blur commits, an empty name is
 * rejected by reverting, and the field is plain text when the provider withheld
 * `save` (there would be nowhere for the new name to go).
 */
function mountField(props: { name?: string; editable?: boolean } = {}) {
  return mountEditor(TemplateNameField, {
    props: {
      // `in`, not `??`: an explicit `name: undefined` is the unnamed-template
      // case and must not fall back to the default.
      name: "name" in props ? props.name : "Welcome",
      editable: props.editable ?? true,
    },
  });
}

describe("TemplateNameField", () => {
  describe("display mode", () => {
    it("renders the name as a button when editable", () => {
      const wrapper = mountField({ name: "Welcome" });

      const trigger = wrapper.find('[data-testid="template-name"]');
      expect(trigger.element.tagName).toBe("BUTTON");
      expect(trigger.text()).toBe("Welcome");
      expect(wrapper.find('[data-testid="template-name-input"]').exists()).toBe(
        false,
      );
    });

    it("renders plain text, not a button, when not editable", () => {
      const wrapper = mountField({ name: "Welcome", editable: false });

      const trigger = wrapper.find('[data-testid="template-name"]');
      expect(trigger.element.tagName).toBe("SPAN");
      expect(trigger.text()).toBe("Welcome");
    });

    it("falls back to the untitled label when there is no name", () => {
      const wrapper = mountField({ name: undefined });

      expect(wrapper.find('[data-testid="template-name"]').text()).toBe(
        "header.untitled",
      );
    });

    it("does not open the editor when not editable", async () => {
      const wrapper = mountField({ editable: false });

      await wrapper.find('[data-testid="template-name"]').trigger("click");

      expect(wrapper.find('[data-testid="template-name-input"]').exists()).toBe(
        false,
      );
    });
  });

  describe("editing", () => {
    it("swaps in an input seeded with the current name on click", async () => {
      const wrapper = mountField({ name: "Welcome" });

      await wrapper.find('[data-testid="template-name"]').trigger("click");

      const input = wrapper.find<HTMLInputElement>(
        '[data-testid="template-name-input"]',
      );
      expect(input.exists()).toBe(true);
      expect(input.element.value).toBe("Welcome");
      expect(wrapper.find('[data-testid="template-name"]').exists()).toBe(false);
    });

    it("seeds an empty input when there is no name yet", async () => {
      const wrapper = mountField({ name: undefined });

      await wrapper.find('[data-testid="template-name"]').trigger("click");

      expect(
        wrapper.find<HTMLInputElement>('[data-testid="template-name-input"]')
          .element.value,
      ).toBe("");
    });

    it("commits on Enter and leaves edit mode", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("Renamed");
      await input.trigger("keydown", { key: "Enter" });

      expect(wrapper.emitted("commit")).toEqual([["Renamed"]]);
      expect(wrapper.find('[data-testid="template-name-input"]').exists()).toBe(
        false,
      );
    });

    it("commits on blur", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("Blurred");
      await input.trigger("blur");

      expect(wrapper.emitted("commit")).toEqual([["Blurred"]]);
    });

    it("cancels on Escape without emitting", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("Discarded");
      await input.trigger("keydown", { key: "Escape" });

      expect(wrapper.emitted("commit")).toBeUndefined();
      expect(wrapper.find('[data-testid="template-name"]').text()).toBe(
        "Welcome",
      );
    });

    it("does not commit the cancelled draft when Escape is followed by blur", async () => {
      // Escape removes the input from the DOM, which fires `blur` — the commit
      // path has to recognise that it already left edit mode.
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("Discarded");
      await input.trigger("keydown", { key: "Escape" });
      await input.trigger("blur");

      expect(wrapper.emitted("commit")).toBeUndefined();
    });

    it("rejects an empty name by reverting to the previous one", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("");
      await input.trigger("keydown", { key: "Enter" });

      expect(wrapper.emitted("commit")).toBeUndefined();
      expect(wrapper.find('[data-testid="template-name"]').text()).toBe(
        "Welcome",
      );
    });

    it("rejects a whitespace-only name", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("   ");
      await input.trigger("keydown", { key: "Enter" });

      expect(wrapper.emitted("commit")).toBeUndefined();
    });

    it("emits the trimmed value", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");
      const input = wrapper.find('[data-testid="template-name-input"]');

      await input.setValue("  Padded  ");
      await input.trigger("keydown", { key: "Enter" });

      expect(wrapper.emitted("commit")).toEqual([["Padded"]]);
    });

    it("does not emit when the name is unchanged", async () => {
      const wrapper = mountField({ name: "Welcome" });
      await wrapper.find('[data-testid="template-name"]').trigger("click");

      await wrapper
        .find('[data-testid="template-name-input"]')
        .trigger("keydown", { key: "Enter" });

      expect(wrapper.emitted("commit")).toBeUndefined();
    });
  });

  describe("accessibility", () => {
    it("labels the trigger and the input", async () => {
      const wrapper = mountField();

      expect(
        wrapper.find('[data-testid="template-name"]').attributes("aria-label"),
      ).toBe("header.rename");

      await wrapper.find('[data-testid="template-name"]').trigger("click");

      expect(
        wrapper
          .find('[data-testid="template-name-input"]')
          .attributes("aria-label"),
      ).toBe("header.templateName");
    });
  });
});
