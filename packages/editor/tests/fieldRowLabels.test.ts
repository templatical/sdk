// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { parse } from "vue/compiler-sfc";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createImageBlock,
  createSectionBlock,
  uniformBorder,
} from "@templatical/types";
import { languageContent, openLanguages } from "./helpers/localization";
import { mountEditor } from "./helpers/mount";
import FieldRow from "../src/components/toolbar/FieldRow.vue";
import ToggleSwitch from "../src/components/ToggleSwitch.vue";

describe("field labels share their language row", () => {
  it("keeps label targets unique across two light-DOM editor apps", () => {
    const mountRow = () =>
      mountEditor(FieldRow, {
        attachTo: document.body,
        props: { label: "Switch" },
        slots: {
          "label-actions": ({ controlId }: { controlId: string }) =>
            h(ToggleSwitch, {
              controlId,
              hideLabel: true,
              modelValue: true,
              label: "Switch",
            }),
        },
      });
    const first = mountRow();
    const second = mountRow();
    try {
      expect(first.get('[role="switch"]').attributes("id")).not.toBe(
        second.get('[role="switch"]').attributes("id"),
      );
      expect(first.get("label").attributes("for")).toBe(
        first.get('[role="switch"]').attributes("id"),
      );
      expect(second.get("label").attributes("for")).toBe(
        second.get('[role="switch"]').attributes("id"),
      );
    } finally {
      first.unmount();
      second.unmount();
    }
  });
  it("keeps a moved switch label associated with and able to activate its control", async () => {
    const content = languageContent();
    content.blocks = [createSectionBlock({ id: "section", columns: "2" })];
    const { wrapper, editor } = await openLanguages({ content });
    editor.selectBlock("section");
    await nextTick();
    await vi.dynamicImportSettled();
    const row = wrapper.get('[data-locale-path="stackOnMobile"]');
    const label = row.get("label");
    const control = row.get('[role="switch"]');
    expect(control.attributes("id")).toBeTruthy();
    expect(label.attributes("for")).toBe(control.attributes("id"));
    (label.element as HTMLLabelElement).click();
    await nextTick();
    expect(control.attributes("aria-checked")).toBe("false");
  });
  it("gives every localized row a label or label slot", () => {
    const missing: string[] = [];
    function scan(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (file.endsWith(".vue")) {
          const { descriptor } = parse(readFileSync(file, "utf8"));
          function walk(node: any) {
            if (
              node.tag === "FieldRow" &&
              node.props.some(
                (p: any) => p.name === "path" || p.arg?.content === "path",
              ) &&
              !node.props.some(
                (p: any) => p.name === "label" || p.arg?.content === "label",
              ) &&
              !node.children.some((child: any) =>
                child.props?.some(
                  (p: any) => p.name === "slot" && p.arg?.content === "label",
                ),
              )
            )
              missing.push(`${entry.name}:${node.loc.start.line}`);
            for (const child of node.children ?? []) walk(child);
          }
          if (descriptor.template) walk(descriptor.template.ast);
        }
      }
    }
    scan(join(import.meta.dirname, "../src/components"));
    expect(missing).toEqual([]);
  });
  it.each(["src", "borderRadius", "border", "styles.padding"])(
    "places %s beside its pill without a second label",
    async (path) => {
      const content = languageContent();
      const image = createImageBlock({
        id: "field-block",
        src: "https://example.com/en.png",
      });
      image.l10n = {
        de: {
          set: {
            src: "https://example.com/de.png",
            borderRadius: 4,
            border: uniformBorder({
              width: 1,
              style: "solid",
              color: "#123456",
            }),
            "styles.padding": { top: 1, right: 1, bottom: 1, left: 1 },
          },
        },
      };
      content.blocks = [image];
      const { wrapper, editor } = await openLanguages({ content });
      editor.setActiveLocale("de");
      editor.selectBlock("field-block");
      await nextTick();
      await vi.dynamicImportSettled();
      const row = wrapper.get(`[data-locale-path="${path}"]`);
      const pill = row.get('[data-testid="field-locale-pill"]');
      const label = row.findAll("label, span").find(
        (node) =>
          node.text() ===
          (
            {
              src: "Image URL",
              borderRadius: "Border Radius",
              border: "Border",
              "styles.padding": "Padding",
            } as Record<string, string>
          )[path],
      )!;
      expect(label.element.parentElement!.contains(pill.element)).toBe(true);
      expect(
        label.element.parentElement!.parentElement!.contains(
          row.get('[data-testid="field-reset"]').element,
        ),
      ).toBe(true);
    },
  );

  it("places a settings label and pill together", async () => {
    const content = languageContent();
    content.settings.l10n = { de: { set: { textColor: "#123456" } } };
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    await wrapper.get("#tpl-tab-settings").trigger("click");
    await vi.dynamicImportSettled();
    const row = wrapper.get('[data-locale-path="settings/textColor"]');
    expect(row.find("label").exists()).toBe(true);
    expect(
      row
        .get("label")
        .element.parentElement!.contains(
          row.get('[data-testid="field-locale-pill"]').element,
        ),
    ).toBe(true);
  });

  it("keeps section radius and its reset on the label row", async () => {
    const content = languageContent();
    content.blocks = [
      createSectionBlock({
        id: "section",
        l10n: { de: { set: { borderRadius: 8 } } },
      }),
    ];
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    editor.selectBlock("section");
    await nextTick();
    await vi.dynamicImportSettled();
    const row = wrapper.get('[data-locale-path="borderRadius"]');
    const label = row
      .findAll("label, span")
      .find((node) => node.text() === "Border Radius")!;
    expect(
      label.element.parentElement!.contains(
        row.get('[data-testid="field-locale-pill"]').element,
      ),
    ).toBe(true);
  });
});
