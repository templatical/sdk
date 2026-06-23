// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import { EDITOR_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import Canvas from "../src/components/Canvas.vue";

/**
 * Regression: #230 — the global (email) background was hidden whenever a
 * section had its own background.
 *
 * The editor canvas is sized to the email's content width, so a full-width
 * section's background covered the entire column and the global background
 * underneath was invisible — even though it renders correctly when the email
 * is sent (`mj-body background-color` shows in the gutters around the centered
 * content).
 *
 * The fix keeps `.tpl-canvas-wrapper` as the true-width content column and
 * wraps it in a wider `.tpl-canvas-stage` that carries the email background.
 * The extra width is a gutter of background on each side that a section can
 * never cover, mirroring the sent output.
 */
describe("canvas background stage (regression: #230)", () => {
  // 96px gutter on each side (see CANVAS_GUTTER in Canvas.vue).
  const GUTTER = 96;

  function mountCanvas(viewport: "desktop" | "mobile") {
    // A full-width section with its own (blue) background — the block that
    // used to hide the global background.
    const section = createSectionBlock({ columns: "1" });
    section.styles.backgroundColor = "#0000ff";

    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = "#ff0000"; // global / email background
    content.settings.width = 600;
    content.blocks = [section];

    const editor = useEditor({ content });

    return mountEditor(Canvas, {
      props: {
        viewport,
        content,
        selectedBlockId: null,
        darkMode: false,
        previewMode: false,
      },
      provides: {
        [EDITOR_KEY]: editor,
        [TRANSLATIONS_KEY]: enTranslations,
      },
    });
  }

  // Anchor on the content column (a reliable descendant); its parent is the
  // stage. Avoids depending on the component's root-node shape.
  function getParts(wrapper: ReturnType<typeof mountCanvas>) {
    const column = wrapper.find('[data-testid="canvas-wrapper"]');
    const stage = column.element.parentElement as HTMLElement;
    return { column: column.element as HTMLElement, stage };
  }

  it("renders the background stage wider than the content column by a gutter each side", () => {
    const wrapper = mountCanvas("desktop");
    const { column, stage } = getParts(wrapper);

    expect(stage.classList.contains("tpl-canvas-stage")).toBe(true);

    // Content column keeps the email's true width; the stage adds GUTTER on
    // each side. The 192px difference is the band of global background a
    // full-width section can never cover.
    expect(column.style.width).toBe("600px");
    expect(stage.style.width).toBe(`${600 + GUTTER * 2}px`);
  });

  it("paints the global background across the full stage, not inside the content column", () => {
    const wrapper = mountCanvas("desktop");
    const { stage } = getParts(wrapper);

    const bg = wrapper.find(".tpl-canvas-bg");
    expect(bg.exists()).toBe(true);

    // The bg layer is a direct child of the stage (so it spans content +
    // gutters), NOT nested inside the content column.
    expect(bg.element.parentElement).toBe(stage);
    expect(wrapper.find(".tpl-canvas-wrapper .tpl-canvas-bg").exists()).toBe(
      false,
    );

    // It carries the global background color (happy-dom may serialize as hex
    // or rgb()).
    const bgColor = (bg.element as HTMLElement).style.backgroundColor
      .replace(/\s+/g, "")
      .toLowerCase();
    expect(["#ff0000", "rgb(255,0,0)"]).toContain(bgColor);
  });

  it("confines the section's own background to the content column so the gutters stay visible", () => {
    const wrapper = mountCanvas("desktop");
    const { column, stage } = getParts(wrapper);

    const section = wrapper.find('[data-block-type="section"]');
    expect(section.exists()).toBe(true);

    // The section lives inside the content column, so its blue background can
    // only paint the 600px column — the stage gutters remain global red.
    expect(column.contains(section.element)).toBe(true);
    expect(section.element.parentElement).not.toBe(stage);
  });

  it("keeps a constant gutter on the mobile viewport (375px content -> 567px stage)", () => {
    const wrapper = mountCanvas("mobile");
    const { column, stage } = getParts(wrapper);

    expect(column.style.width).toBe("375px");
    expect(stage.style.width).toBe(`${375 + GUTTER * 2}px`);
  });
});
