// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { nextTick } from "vue";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mountCrowdedHeader } from "../../../apps/playground/e2e/helpers/localization-header";

const src = (file: string) =>
  readFileSync(join(import.meta.dirname, "../src", file), "utf8");

/** happy-dom has no layout engine: supply measured browser geometry only. */
async function measuredHeader(
  shadow: boolean,
  width: number,
  rightWidth: number,
) {
  let containerWidth = width;
  let metricScale = 1;
  let overflowingControl: HTMLElement | null = null;
  const pendingFrames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 0;
  const requestFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      const id = ++nextFrameId;
      pendingFrames.set(id, callback);
      return id;
    });
  const cancelFrame = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((id) => {
      pendingFrames.delete(id);
    });
  onTestFinished(() => {
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });
  const resizeCallbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push((entries, observer) => {
          const observed = entries.filter((entry) =>
            this.targets.has(entry.target),
          );
          if (observed.length) callback(observed, observer);
        });
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect = vi.fn(() => this.targets.clear());
    },
  );
  const original = HTMLElement.prototype.getBoundingClientRect;
  const geometry = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this === overflowingControl)
        return {
          x: -100,
          y: 0,
          width: 100,
          height: 56,
          left: -100,
          right: 0,
          top: 0,
          bottom: 56,
          toJSON() {},
        };
      let measured = 0;
      if (this.classList.contains("tpl-header-container")) {
        measured = containerWidth;
      } else if (this.classList.contains("tpl-header-metric-probe")) {
        measured = 100 * metricScale;
      } else if (this.closest('[data-compact="true"]')) {
        measured = 80;
      } else if (this.classList.contains("tpl-header-left")) {
        measured = 170;
      } else if (this.classList.contains("tpl-header-center")) {
        measured = 300;
      } else if (this.classList.contains("tpl-header-right")) {
        measured = this.textContent?.includes("Long translated comments")
          ? 500
          : this.textContent?.includes("Short comments")
            ? 200
            : this.querySelector(".tpl-header-comment-count")?.closest("button")
                  ?.hidden === false
              ? rightWidth
              : 200;
      } else {
        return original.call(this);
      }
      if (
        this.matches(
          ".tpl-header-left, .tpl-header-center, .tpl-header-right",
        ) &&
        !this.closest('[data-compact="true"]')
      )
        measured *= metricScale;
      return {
        x: 0,
        y: 0,
        width: measured,
        height: 56,
        top: 0,
        right: measured,
        bottom: 56,
        left: 0,
        toJSON() {},
      };
    });
  onTestFinished(() => geometry.mockRestore());
  const unmount = await mountCrowdedHeader(shadow);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unmount();
  };
  onTestFinished(dispose);
  await vi.dynamicImportSettled();
  await nextTick();
  const host = document.querySelector(
    '[data-testid="language-header-harness"]',
  )!;
  const root = shadow ? host.shadowRoot! : host;
  const header = root.querySelector("header")!;
  // In the browser these utility classes resolve to 16px. Give the DOM
  // simulator the same geometry without replacing any component logic.
  (header as HTMLElement).style.paddingInline = "16px";
  const deliverMutations = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  };
  const frame = async () => {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    for (const callback of callbacks) callback(0);
    await nextTick();
  };
  const settle = async () => {
    await deliverMutations();
    await frame();
    await deliverMutations();
  };
  const notifyResize = (nextWidth: number, target = header.parentElement!) => {
    containerWidth = nextWidth;
    for (const callback of resizeCallbacks) {
      callback(
        [
          {
            target,
            contentRect: target.getBoundingClientRect(),
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    }
  };
  await settle();
  return {
    root,
    header,
    settle,
    deliverMutations,
    frame,
    notifyResize,
    overflowTrack(control: HTMLElement) {
      overflowingControl = control;
    },
    changeMetrics(
      kind: "base size" | "font family" | "root font size",
      scale: number,
    ) {
      metricScale = scale;
      if (kind === "base size")
        (host as HTMLElement).style.setProperty(
          "--tpl-user-base-size",
          `${16 * scale}px`,
        );
      else if (kind === "font family")
        (host as HTMLElement).style.fontFamily = "monospace";
      else {
        const rootStyle = document.documentElement.style;
        const previous = rootStyle.fontSize;
        rootStyle.fontSize = `${16 * scale}px`;
        onTestFinished(() => {
          rootStyle.fontSize = previous;
        });
      }
    },
    pendingFrameCount: () => pendingFrames.size,
    dispose,
    async resize(nextWidth: number) {
      notifyResize(nextWidth);
      await settle();
    },
  };
}

describe("header measured compaction", () => {
  it.each([false, true])(
    "keeps full labels when they fit below the former breakpoint (shadow: %s)",
    async (shadow) => {
      const { header } = await measuredHeader(shadow, 800, 200);
      // 300px centre + two 200px side tracks + 32px padding = 732px.
      expect(header.getAttribute("data-compact")).toBe("false");
      expect(Number(header.getAttribute("data-full-width"))).toBe(732);
    },
  );

  it.each([false, true])(
    "compacts overflowing full labels above the former breakpoint (shadow: %s)",
    async (shadow) => {
      const { header } = await measuredHeader(shadow, 1100, 400);
      // The larger right group needs 400px on each side of the fixed centre.
      expect(header.getAttribute("data-compact")).toBe("true");
      expect(Number(header.getAttribute("data-full-width"))).toBe(1132);
    },
  );

  it("retains the full-label requirement in the compact/full hysteresis band", async () => {
    const { header, resize } = await measuredHeader(false, 900, 400);
    expect(header.getAttribute("data-compact")).toBe("true");
    await resize(1050);
    expect(header.getAttribute("data-compact")).toBe("true");
    await resize(1132);
    expect(header.getAttribute("data-compact")).toBe("false");
    await resize(1131);
    expect(header.getAttribute("data-compact")).toBe("true");
  });

  it("remeasures changed full-label content while compact without first showing the full layout", async () => {
    const { header, resize, settle } = await measuredHeader(false, 800, 400);
    expect(header.getAttribute("data-compact")).toBe("true");
    const comments = header.querySelector(
      '[data-testid="comments-trigger"] .tpl-header-label',
    )!;
    comments.textContent = "Long translated comments";
    await settle();
    expect(header.getAttribute("data-compact")).toBe("true");
    expect(Number(header.getAttribute("data-full-width"))).toBe(1332);
    await resize(1200);
    expect(header.getAttribute("data-compact")).toBe("true");
    comments.textContent = "Short comments";
    await settle();
    expect(header.getAttribute("data-compact")).toBe("false");
    expect(Number(header.getAttribute("data-full-width"))).toBe(732);
  });

  it("remeasures provider controls removed while compact", async () => {
    const { header, settle } = await measuredHeader(false, 800, 400);
    expect(header.getAttribute("data-compact")).toBe("true");
    header.querySelector('[data-testid="comments-trigger"]')!.remove();
    await settle();
    expect(header.getAttribute("data-compact")).toBe("false");
    expect(Number(header.getAttribute("data-full-width"))).toBe(732);
  });

  it("remeasures hidden and restored controls without a container resize", async () => {
    const { header, settle } = await measuredHeader(false, 800, 400);
    const comments = header.querySelector<HTMLButtonElement>(
      '[data-testid="comments-trigger"]',
    )!;
    expect(header.getAttribute("data-compact")).toBe("true");
    comments.hidden = true;
    await settle();
    expect(header.getAttribute("data-compact")).toBe("false");
    expect(Number(header.getAttribute("data-full-width"))).toBe(732);
    comments.hidden = false;
    await settle();
    expect(header.getAttribute("data-compact")).toBe("true");
    expect(Number(header.getAttribute("data-full-width"))).toBe(1132);
  });

  it.each([false, true])(
    "retains accessible names and tooltips on compact controls (shadow: %s)",
    async (shadow) => {
      const { root, header } = await measuredHeader(shadow, 700, 400);
      expect(header.getAttribute("data-compact")).toBe("true");
      for (const button of header.querySelectorAll(
        '.tpl-header-center button, [data-testid="language-menu"], [data-testid="comments-trigger"], [data-testid="ai-menu-trigger"], [data-testid="test-email-trigger"], [data-testid="template-save"]',
      )) {
        expect(button.getAttribute("aria-label")).toBeTruthy();
        expect(button.getAttribute("title")).toBeTruthy();
      }
      expect(
        root.querySelectorAll('[data-testid="language-menu"]'),
      ).toHaveLength(1);
      expect(root.querySelectorAll("header")).toHaveLength(1);
      expect(root.querySelector(".tpl-header-measure")).toBeNull();
    },
  );

  it.each([false, true])(
    "coalesces resize and content invalidations into one full measurement per frame (shadow: %s)",
    async (shadow) => {
      const { header, notifyResize, deliverMutations, frame } =
        await measuredHeader(shadow, 900, 400);
      const append = vi.spyOn(header.parentElement!, "appendChild");
      onTestFinished(() => append.mockRestore());
      const copies = () =>
        append.mock.calls.filter(([element]) =>
          (element as HTMLElement).classList?.contains("tpl-header-measure"),
        ).length;
      notifyResize(1000);
      window.dispatchEvent(new Event("resize"));
      header.querySelector(
        '[data-testid="comments-trigger"] .tpl-header-label',
      )!.textContent = "Long translated comments";
      await deliverMutations();
      notifyResize(1100);
      header
        .querySelector('[data-testid="comments-trigger"]')!
        .setAttribute("title", "Changed tooltip");
      await deliverMutations();
      window.dispatchEvent(new Event("resize"));
      await frame();
      expect(copies()).toBe(1);
      expect(Number(header.getAttribute("data-full-width"))).toBe(1332);
      expect(header.getAttribute("data-compact")).toBe("true");
    },
  );

  it.each([false, true])(
    "reuses recorded full width for container and compact-grid resize deliveries (shadow: %s)",
    async (shadow) => {
      const { header, notifyResize, frame, overflowTrack } =
        await measuredHeader(shadow, 900, 400);
      const append = vi.spyOn(header.parentElement!, "appendChild");
      onTestFinished(() => append.mockRestore());
      const copies = () =>
        append.mock.calls.filter(([element]) =>
          (element as HTMLElement).classList?.contains("tpl-header-measure"),
        ).length;
      notifyResize(1200);
      window.dispatchEvent(new Event("resize"));
      await frame();
      expect(copies()).toBe(0);
      expect(Number(header.getAttribute("data-full-width"))).toBe(1132);
      expect(header.getAttribute("data-compact")).toBe("false");
      for (const group of header.children)
        notifyResize(1200, group as HTMLElement);
      await frame();
      expect(copies()).toBe(0);
      expect(Number(header.getAttribute("data-full-width"))).toBe(1132);
      expect(header.getAttribute("data-compact")).toBe("false");
      // The still-full controls extend beyond their narrower tracks until
      // the cached-width decision switches the real header to compact.
      overflowTrack(
        header.querySelector<HTMLElement>(".tpl-header-right > button")!,
      );
      notifyResize(1100);
      await frame();
      expect(copies()).toBe(0);
      expect(header.getAttribute("data-compact")).toBe("true");
    },
  );

  it.each(
    [false, true].flatMap((shadow) =>
      (["base size", "font family", "root font size"] as const).flatMap(
        (metric) =>
          [false, true].map((compact) => ({ shadow, metric, compact })),
      ),
    ),
  )(
    "remeasures inherited $metric in a $compact compact header (shadow: $shadow)",
    async ({ shadow, metric, compact }) => {
      const { header, notifyResize, deliverMutations, frame, changeMetrics } =
        await measuredHeader(shadow, 800, compact ? 400 : 200);
      expect(header.getAttribute("data-compact")).toBe(String(compact));
      expect(Number(header.getAttribute("data-full-width"))).toBe(
        compact ? 1132 : 732,
      );
      const append = vi.spyOn(header.parentElement!, "appendChild");
      onTestFinished(() => append.mockRestore());
      const copies = () =>
        append.mock.calls.filter(([element]) =>
          (element as HTMLElement).classList?.contains("tpl-header-measure"),
        );
      changeMetrics(metric, compact ? 0.5 : 1.25);
      await deliverMutations();
      const probe = header.querySelector<HTMLElement>(
        ".tpl-header-metric-probe",
      );
      // A real browser delivers this for the inherited font change. The fallback
      // keeps the old implementation's failure about stale width, not a selector.
      notifyResize(800, probe ?? header.parentElement!);
      notifyResize(800);
      window.dispatchEvent(new Event("resize"));
      await frame();
      expect(Number(header.getAttribute("data-full-width"))).toBe(
        compact ? 582 : 907,
      );
      expect(header.getAttribute("data-compact")).toBe(String(!compact));
      expect(copies()).toHaveLength(1);
      expect(
        (copies()[0][0] as HTMLElement).querySelector(
          ".tpl-header-metric-probe",
        ),
      ).toBeNull();
      append.mockClear();
      notifyResize(1200);
      window.dispatchEvent(new Event("resize"));
      await frame();
      expect(copies()).toHaveLength(0);
      expect(Number(header.getAttribute("data-full-width"))).toBe(
        compact ? 582 : 907,
      );
      expect(header.getAttribute("data-compact")).toBe("false");
    },
  );

  it.each([false, true])(
    "owns a layout-neutral metric probe without measuring unchanged notifications (shadow: %s)",
    async (shadow) => {
      const { header, notifyResize, frame } = await measuredHeader(
        shadow,
        800,
        200,
      );
      const probe = header.querySelector<HTMLElement>(
        ".tpl-header-metric-probe",
      );
      expect(probe).not.toBeNull();
      expect(probe!.getAttribute("aria-hidden")).toBe("true");
      expect(probe!.inert).toBe(true);
      expect(probe!.id).toBe("");
      expect(probe!.tabIndex).toBe(-1);
      expect(probe!.style.position).toBe("absolute");
      expect(probe!.style.visibility).toBe("hidden");
      expect(probe!.style.pointerEvents).toBe("none");
      expect(probe!.style.font).toBe("inherit");
      const append = vi.spyOn(header.parentElement!, "appendChild");
      onTestFinished(() => append.mockRestore());
      notifyResize(800, probe!);
      await frame();
      expect(append.mock.calls).toHaveLength(0);
    },
  );

  it.each([false, true])(
    "remeasures full controls overflowing their track without a metric notification (shadow: %s)",
    async (shadow) => {
      const {
        header,
        changeMetrics,
        notifyResize,
        deliverMutations,
        frame,
        overflowTrack,
      } = await measuredHeader(shadow, 800, 200);
      const group = header.querySelector<HTMLElement>(".tpl-header-right")!;
      const control = group.querySelector<HTMLElement>(":scope > button")!;
      overflowTrack(control);
      const append = vi.spyOn(header.parentElement!, "appendChild");
      onTestFinished(() => append.mockRestore());
      changeMetrics("base size", 1.25);
      await deliverMutations();
      notifyResize(800, group);
      await frame();
      expect(Number(header.getAttribute("data-full-width"))).toBe(907);
      expect(header.getAttribute("data-compact")).toBe("true");
      expect(
        append.mock.calls.filter(([element]) =>
          (element as HTMLElement).classList?.contains("tpl-header-measure"),
        ),
      ).toHaveLength(1);
    },
  );

  it("cancels a scheduled content measurement on unmount", async () => {
    const { header, deliverMutations, pendingFrameCount, dispose, frame } =
      await measuredHeader(false, 900, 400);
    const append = vi.spyOn(header.parentElement!, "appendChild");
    onTestFinished(() => append.mockRestore());
    header
      .querySelector('[data-testid="comments-trigger"]')!
      .setAttribute("title", "Changed tooltip");
    await deliverMutations();
    expect(pendingFrameCount()).toBe(1);
    dispose();
    expect(pendingFrameCount()).toBe(0);
    await frame();
    expect(append.mock.calls).toHaveLength(0);
  });

  it("owns compact styling in the sheet adopted by shadow roots", () => {
    const css = src("styles/index.css");
    expect(css).not.toMatch(/@container tpl-header/);
    expect(css).toContain('.tpl-header[data-compact="true"]');
    const hidden = css.search(/\.tpl-language-tag\s*\{\s*display: none;/);
    const compact = css.indexOf('.tpl-header[data-compact="true"]');
    expect(hidden).toBeGreaterThan(-1);
    expect(hidden).toBeLessThan(compact);
    expect(css.slice(compact)).toMatch(
      /\.tpl-language-tag\s*\{\s*display: inline;/,
    );
    expect(src("components/localization/LanguageMenu.vue")).not.toMatch(
      /\.tpl-language-tag\s*\{/,
    );
  });
});
