// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import StorageProgressRing from "../src/components/media/StorageProgressRing.vue";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const wrappers: VueWrapper[] = [];

function mountRing(props: {
  usedBytes: number;
  limitBytes: number;
  size?: number;
}): VueWrapper {
  const wrapper = mount(StorageProgressRing, {
    props,
    global: {
      stubs: {
        Transition: {
          setup(
            _props: unknown,
            { slots }: { slots: { default?: () => unknown } },
          ) {
            return () => slots.default?.();
          },
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function progressCircle(wrapper: VueWrapper) {
  return wrapper.findAll("circle")[1];
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
});

describe("StorageProgressRing", () => {
  it("labels used, total and remaining with the shared size format", () => {
    const wrapper = mountRing({ usedBytes: 1.5 * GB, limitBytes: 5 * GB });
    expect(
      wrapper
        .get('[data-testid="media-storage-ring"]')
        .attributes("aria-label"),
    ).toBe("1.5 GB of 5 GB used (3.5 GB remaining)");
  });

  it("never reports negative space when usage is over the limit", () => {
    const wrapper = mountRing({ usedBytes: 600 * MB, limitBytes: 500 * MB });
    expect(
      wrapper
        .get('[data-testid="media-storage-ring"]')
        .attributes("aria-label"),
    ).toBe("600 MB of 500 MB used (0 B remaining)");
    // Clamped at 100%: the stroke is fully drawn.
    expect(
      Number(progressCircle(wrapper).attributes("stroke-dashoffset")),
    ).toBe(0);
  });

  it.each([
    [50, "var(--tpl-primary)"],
    [75, "var(--tpl-warning)"],
    [94, "var(--tpl-warning)"],
    [95, "var(--tpl-danger)"],
  ])("colours the ring at %d%% used", (percent, colour) => {
    const wrapper = mountRing({ usedBytes: percent, limitBytes: 100 });
    expect(progressCircle(wrapper).attributes("stroke")).toBe(colour);
  });

  it("draws nothing when the limit is zero", () => {
    const wrapper = mountRing({ usedBytes: 10, limitBytes: 0 });
    const circle = progressCircle(wrapper);
    expect(circle.attributes("stroke-dashoffset")).toBe(
      circle.attributes("stroke-dasharray"),
    );
    expect(circle.attributes("stroke")).toBe("var(--tpl-primary)");
  });

  it("sizes the ring from the size prop, defaulting to 24", () => {
    expect(
      mountRing({ usedBytes: 1, limitBytes: 2 }).get("svg").attributes("width"),
    ).toBe("24");
    const large = mountRing({ usedBytes: 1, limitBytes: 2, size: 40 });
    expect(large.get("svg").attributes("viewBox")).toBe("0 0 40 40");
    // strokeWidth = size / 8 above the 2px floor.
    expect(progressCircle(large).attributes("stroke-width")).toBe("5");
  });

  it("shows the tooltip on hover and focus, and hides it on leave and blur", async () => {
    const wrapper = mountRing({ usedBytes: 2 * MB, limitBytes: 10 * MB });
    const ring = wrapper.get('[data-testid="media-storage-ring"]');
    const tooltip = () => wrapper.text();

    expect(tooltip()).toBe("");
    await ring.trigger("mouseenter");
    expect(tooltip()).toBe("2 MB of 10 MB used (8 MB remaining)");
    await ring.trigger("mouseleave");
    expect(tooltip()).toBe("");
    await ring.trigger("focus");
    expect(tooltip()).toBe("2 MB of 10 MB used (8 MB remaining)");
    await ring.trigger("blur");
    expect(tooltip()).toBe("");
  });
});
