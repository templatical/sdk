// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import {
  createCountdownBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import CountdownBlock from "../src/components/blocks/CountdownBlock.vue";
import { mountEditor } from "./helpers/mount";
import {
  COUNTDOWN_PROVIDER_KEY,
  EDITOR_KEY,
  IMAGE_URL_RESOLVER_KEY,
} from "../src/keys";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";

const DATE = "2026-12-24T17:00:00.000Z";
const FIRST = "https://example.com/first.gif";
const SECOND = "https://example.com/second.gif";

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    FakeImage.instances.push(this);
  }
  load() {
    this.onload?.();
  }
  error() {
    this.onerror?.();
  }
}

const block = (overrides: Parameters<typeof createCountdownBlock>[0] = {}) =>
  createCountdownBlock({ targetDate: DATE, ...overrides });

function mount(
  overrides: Parameters<typeof createCountdownBlock>[0] = {},
  imageUrl?: (item: ReturnType<typeof block>) => string,
) {
  return mountEditor(CountdownBlock, {
    props: { block: block(overrides), viewport: "desktop" },
    provides: imageUrl ? { [COUNTDOWN_PROVIDER_KEY]: { imageUrl } } : {},
  });
}

beforeEach(() => {
  FakeImage.instances = [];
  vi.stubGlobal("Image", FakeImage);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CountdownBlock", () => {
  it("shows the date hint when targetDate is empty", () => {
    const wrapper = mount({ targetDate: "" });
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("no-date");
    expect(wrapper.text()).toBe("countdown.setDate");
    expect(FakeImage.instances).toHaveLength(0);
  });

  it("shows no-image without a provider", () => {
    const wrapper = mount();
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("no-image");
    expect(wrapper.text()).toBe("countdown.noImage");
    expect(FakeImage.instances).toHaveLength(0);
  });

  it.each(["", "   "])("shows no-image for a provider URL of %j", (url) => {
    const wrapper = mount({}, () => url);
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("no-image");
    expect(wrapper.text()).toBe("countdown.noImage");
    expect(FakeImage.instances).toHaveLength(0);
  });

  it("requests the first resolved URL immediately and shows loading until load", async () => {
    vi.useFakeTimers();
    const content = createDefaultTemplateContent();
    content.settings.locale = "de";
    const wrapper = mountEditor(CountdownBlock, {
      props: {
        block: block({ timezone: "Europe/Berlin" }),
        viewport: "desktop",
      },
      provides: {
        [COUNTDOWN_PROVIDER_KEY]: { imageUrl: () => FIRST },
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver(
          (src) => `${src}?preview=1`,
        ),
        [EDITOR_KEY]: { content: ref(content) },
      },
    });
    expect(FakeImage.instances.map((image) => image.src)).toEqual([
      `${FIRST}?preview=1`,
    ]);
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("loading");
    expect(wrapper.text()).toBe("countdown.updating");
    FakeImage.instances[0].load();
    await nextTick();
    expect(
      wrapper.get('[data-testid="countdown-image"]').attributes("src"),
    ).toBe(`${FIRST}?preview=1`);
    expect(
      wrapper.get('[data-testid="countdown-image"]').attributes("alt"),
    ).toBe("Countdown: 24. Dezember 2026 um 18:00 (Europe/Berlin)");
    expect(wrapper.find('[data-testid="countdown-placeholder"]').exists()).toBe(
      false,
    );
  });

  it("debounces rapid edits into one later image request", async () => {
    vi.useFakeTimers();
    const wrapper = mount(
      { labelDays: "first" },
      (item) => `https://example.com/${item.labelDays}.gif`,
    );
    expect(FakeImage.instances.map((image) => image.src)).toEqual([FIRST]);
    await wrapper.setProps({ block: block({ labelDays: "draft" }) });
    await vi.advanceTimersByTimeAsync(250);
    await wrapper.setProps({ block: block({ labelDays: "second" }) });
    await vi.advanceTimersByTimeAsync(399);
    expect(FakeImage.instances.map((image) => image.src)).toEqual([FIRST]);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeImage.instances.map((image) => image.src)).toEqual(["", SECOND]);
  });

  it("dims the old image while updating and swaps after full load", async () => {
    vi.useFakeTimers();
    const wrapper = mount(
      { labelDays: "first" },
      (item) => `https://example.com/${item.labelDays}.gif`,
    );
    FakeImage.instances[0].load();
    await nextTick();
    await wrapper.setProps({ block: block({ labelDays: "second" }) });
    await vi.advanceTimersByTimeAsync(400);
    expect(
      wrapper.get('[data-testid="countdown-image"]').attributes("src"),
    ).toBe(FIRST);
    expect(wrapper.get('[data-testid="countdown-image"]').classes()).toContain(
      "tpl:opacity-50",
    );
    expect(wrapper.get('[data-testid="countdown-updating"]').text()).toBe(
      "countdown.updating",
    );
    expect(
      wrapper.get('[data-testid="countdown-updating"]').attributes("role"),
    ).toBe("status");
    FakeImage.instances[1].load();
    await nextTick();
    expect(
      wrapper.get('[data-testid="countdown-image"]').attributes("src"),
    ).toBe(SECOND);
    expect(
      wrapper.get('[data-testid="countdown-image"]').classes(),
    ).not.toContain("tpl:opacity-50");
    expect(wrapper.find('[data-testid="countdown-updating"]').exists()).toBe(
      false,
    );
  });

  it("ignores a stale load after a newer target", async () => {
    vi.useFakeTimers();
    const wrapper = mount(
      { labelDays: "first" },
      (item) => `https://example.com/${item.labelDays}.gif`,
    );
    const staleLoad = FakeImage.instances[0].onload;
    await wrapper.setProps({ block: block({ labelDays: "second" }) });
    await vi.advanceTimersByTimeAsync(400);
    expect(FakeImage.instances[0].onload).toBeNull();
    staleLoad?.();
    await nextTick();
    expect(wrapper.find('[data-testid="countdown-image"]').exists()).toBe(
      false,
    );
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("loading");
    FakeImage.instances[1].load();
    await nextTick();
    expect(
      wrapper.get('[data-testid="countdown-image"]').attributes("src"),
    ).toBe(SECOND);
  });

  it("shows failed URL as text when the first request errors", async () => {
    const url = 'https://example.com/<bad>&".gif';
    const wrapper = mount({}, () => url);
    FakeImage.instances[0].error();
    await nextTick();
    const placeholder = wrapper.get('[data-testid="countdown-placeholder"]');
    expect(placeholder.attributes("data-state")).toBe("failed");
    expect(placeholder.text()).toContain("countdown.imageFailed");
    expect(placeholder.text()).toContain(url);
    expect(placeholder.html()).not.toContain("<bad>");
    expect(wrapper.find('[data-testid="countdown-image"]').exists()).toBe(
      false,
    );
  });

  it("keeps the failed state when the block changes but its URL does not", async () => {
    vi.useFakeTimers();
    const url = "https://example.com/broken.gif";
    const wrapper = mount({ labelDays: "first" }, () => url);
    FakeImage.instances[0].error();
    await nextTick();
    await wrapper.setProps({ block: block({ labelDays: "second" }) });
    await vi.advanceTimersByTimeAsync(400);
    const placeholder = wrapper.get('[data-testid="countdown-placeholder"]');
    expect(placeholder.attributes("data-state")).toBe("failed");
    expect(placeholder.text()).toContain(url);
    expect(FakeImage.instances).toHaveLength(1);
  });

  it("announces the first load as a status", () => {
    const wrapper = mount({}, () => "https://example.com/first.gif");
    const placeholder = wrapper.get('[data-testid="countdown-placeholder"]');
    expect(placeholder.attributes("data-state")).toBe("loading");
    expect(placeholder.attributes("role")).toBe("status");
  });

  it("shows failure instead of the earlier image when the replacement errors", async () => {
    vi.useFakeTimers();
    const wrapper = mount(
      { labelDays: "first" },
      (item) => `https://example.com/${item.labelDays}.gif`,
    );
    FakeImage.instances[0].load();
    await nextTick();
    await wrapper.setProps({ block: block({ labelDays: "second" }) });
    await vi.advanceTimersByTimeAsync(400);
    FakeImage.instances[1].error();
    await nextTick();
    expect(
      wrapper
        .get('[data-testid="countdown-placeholder"]')
        .attributes("data-state"),
    ).toBe("failed");
    expect(wrapper.text()).toContain(SECOND);
    expect(wrapper.find('[data-testid="countdown-image"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="countdown-updating"]').exists()).toBe(
      false,
    );
  });

  it.each([
    { targetDate: DATE, hideOnExpiry: false },
    { targetDate: "2020-01-01T00:00:00.000Z", hideOnExpiry: false },
    { targetDate: "2020-01-01T00:00:00.000Z", hideOnExpiry: true },
  ])(
    "draws no ticker for $targetDate with hideOnExpiry=$hideOnExpiry",
    async (settings) => {
      const wrapper = mount(
        { ...settings, separator: "|", expiredMessage: "Expired marker" },
        () => FIRST,
      );
      FakeImage.instances[0].load();
      await nextTick();
      expect(
        wrapper.get('[data-testid="countdown-image"]').attributes("src"),
      ).toBe(FIRST);
      expect(wrapper.findAll(".tpl\\:gap-2")).toHaveLength(0);
      expect(wrapper.text()).not.toContain("|");
      expect(wrapper.text()).not.toContain("Expired marker");
      expect(wrapper.text()).not.toContain("Hidden (expired)");
      expect(wrapper.text()).not.toContain("countdown.hidden");
    },
  );
});
