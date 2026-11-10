// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, shallowRef } from "vue";
import { mount } from "@vue/test-utils";
import { decideHeaderFit, useHeaderFit } from "../src/composables/useHeaderFit";

const measurement = {
  availableWidth: 800,
  leftWidth: 170,
  centerWidth: 300,
  rightWidth: 200,
  paddingWidth: 32,
  columnGap: 0,
  borderWidth: 0,
};

describe("header fit decision", () => {
  it("keeps full labels when they fit below the former fixed breakpoint", () => {
    expect(decideHeaderFit(measurement)).toEqual({
      compact: false,
      fullWidth: 732,
      statusLabel: true,
    });
  });

  it("compacts an overflowing full layout above the former fixed breakpoint", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1100,
        rightWidth: 400,
      }),
    ).toEqual({ compact: true, fullWidth: 1132, statusLabel: false });
  });

  it("reserves equal side tracks so the larger left group cannot cover the centre", () => {
    expect(
      decideHeaderFit({ ...measurement, availableWidth: 1000, leftWidth: 400 }),
    ).toEqual({ compact: true, fullWidth: 1132, statusLabel: false });
  });

  it("includes both column gaps, padding and borders at the exact fit boundary", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 750,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: false, fullWidth: 750, statusLabel: true });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 749,
        columnGap: 8,
        borderWidth: 2,
      }),
    ).toEqual({ compact: true, fullWidth: 750, statusLabel: false });
  });

  it("stays compact throughout the band that fits only compact controls", () => {
    const full = { ...measurement, rightWidth: 400 };
    expect(
      [900, 1050, 1131, 1132].map((availableWidth) =>
        decideHeaderFit({ ...full, availableWidth }),
      ),
    ).toEqual([
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: true, fullWidth: 1132, statusLabel: false },
      { compact: false, fullWidth: 1132, statusLabel: true },
    ]);
  });

  it("replaces the full-width requirement when hidden full-label content changes", () => {
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 500,
      }),
    ).toEqual({ compact: true, fullWidth: 1332, statusLabel: false });
    expect(
      decideHeaderFit({
        ...measurement,
        availableWidth: 1200,
        rightWidth: 200,
      }),
    ).toEqual({ compact: false, fullWidth: 732, statusLabel: true });
  });

  it("measures the host's full in-flow width without an absolute menu or inline-style changes", async () => {
    const container = document.createElement("div");
    const header = document.createElement("header");
    header.className = "tpl-header";
    header.innerHTML =
      '<div class="tpl-header-left"></div><div class="tpl-header-center"></div><div class="tpl-header-right"><span class="tpl-header-actions"></span></div>';
    const host = document.createElement("span");
    host.dataset.tplCompact = "true";
    host.style.cssText = "color: red; width: 41px; flex-shrink: 2;";
    const originalStyle = host.getAttribute("style");
    const menu = document.createElement("div");
    menu.style.position = "absolute";
    menu.style.width = "700px";
    host.appendChild(menu);
    Object.defineProperty(host, "scrollWidth", {
      get: () => 700,
    });
    header.querySelector(".tpl-header-actions")!.appendChild(host);
    container.appendChild(header);
    document.body.appendChild(container);
    const rect = (width: number) =>
      ({
        width,
        left: 0,
        right: width,
        height: 20,
        top: 0,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    const boxes = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this === container) return rect(900);
        if (this === host)
          return rect(
            host.style.width === "max-content" &&
              host.style.flexShrink === "0" &&
              host.dataset.tplCompact === undefined
              ? 280
              : 80,
          );
        if (this.classList.contains("tpl-header-left")) return rect(100);
        if (this.classList.contains("tpl-header-center")) return rect(300);
        if (this.classList.contains("tpl-header-right")) {
          const placeholder = this.querySelector<HTMLElement>(
            ".tpl-header-action-measure",
          );
          return rect(100 + Number.parseFloat(placeholder?.style.width ?? "0"));
        }
        return rect(0);
      });
    let fit!: ReturnType<typeof useHeaderFit>;
    const Harness = defineComponent({
      setup() {
        fit = useHeaderFit(shallowRef(container), shallowRef(header), host);
        return () => h("div");
      },
    });
    const wrapper = mount(Harness);
    try {
      expect(fit.compact.value).toBe(true);
      expect(fit.fullWidth.value).toBe(1060);
      expect(host.dataset.tplCompact).toBe("true");
      expect(host.getAttribute("style")).toBe(originalStyle);
      window.dispatchEvent(new Event("resize"));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      expect(fit.compact.value).toBe(true);
      expect(fit.fullWidth.value).toBe(1060);
      expect(host.getAttribute("style")).toBe(originalStyle);
    } finally {
      wrapper.unmount();
      boxes.mockRestore();
      container.remove();
    }
  });

  it("omits the action placeholder when no host actions exist", () => {
    const container = document.createElement("div");
    const header = document.createElement("header");
    header.className = "tpl-header";
    header.innerHTML =
      '<div class="tpl-header-left"></div><div class="tpl-header-center"></div><div class="tpl-header-right"><button>Save</button><span class="tpl-header-actions"></span></div>';
    container.appendChild(header);
    document.body.appendChild(container);
    const rect = (width: number) =>
      ({
        width,
        left: 0,
        right: width,
        height: 20,
        top: 0,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    const boxes = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this === container) return rect(900);
        if (this.classList.contains("tpl-header-left")) return rect(100);
        if (this.classList.contains("tpl-header-center")) return rect(300);
        if (this.classList.contains("tpl-header-right")) {
          return rect(
            200 + (this.querySelector(".tpl-header-action-measure") ? 12 : 0),
          );
        }
        return rect(0);
      });
    let fit!: ReturnType<typeof useHeaderFit>;
    const Harness = defineComponent({
      setup() {
        fit = useHeaderFit(shallowRef(container), shallowRef(header));
        return () => h("div");
      },
    });
    const wrapper = mount(Harness);
    try {
      expect(fit.fullWidth.value).toBe(700);
    } finally {
      wrapper.unmount();
      boxes.mockRestore();
      container.remove();
    }
  });

  describe("save-status label", () => {
    // The status badge's words come and go with every edit and save. They
    // never decide the layout: the full width is measured without them, and
    // they show only where the full header has room for them too.
    const withStatus = {
      ...measurement,
      rightWidth: 300,
      statusLabelWidth: 60,
    };

    it("leaves the label out of the full-width requirement", () => {
      expect(decideHeaderFit({ ...withStatus, availableWidth: 900 })).toEqual({
        compact: false,
        fullWidth: 812,
        statusLabel: false,
      });
    });

    it("keeps the full header and hides only the label when the label alone does not fit", () => {
      expect(
        [811, 812, 931, 932].map((availableWidth) =>
          decideHeaderFit({ ...withStatus, availableWidth }),
        ),
      ).toEqual([
        { compact: true, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: false },
        { compact: false, fullWidth: 812, statusLabel: true },
      ]);
    });

    it("counts the label only when it makes the right side the wider one", () => {
      const left = { ...measurement, availableWidth: 800, leftWidth: 230 };
      expect(
        decideHeaderFit({ ...left, rightWidth: 220, statusLabelWidth: 60 }),
      ).toEqual({ compact: false, fullWidth: 792, statusLabel: true });
      expect(
        decideHeaderFit({ ...left, rightWidth: 290, statusLabelWidth: 60 }),
      ).toEqual({ compact: false, fullWidth: 792, statusLabel: false });
    });
  });
});
