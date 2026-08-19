// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import type { Translations } from "@templatical/types";
import TemplateTimestamp from "../src/components/TemplateTimestamp.vue";
import { mountEditor } from "./helpers/mount";
import { TRANSLATIONS_KEY } from "../src/keys";

/**
 * The header's write-time line. It exists to answer "is what my store holds
 * current?", so the rules that matter are: the wording tracks which field the
 * store supplied, an unusable value renders nothing at all rather than
 * something wrong, and the label keeps up with the clock — a header stays open
 * for hours, and a relative label computed once is wrong for most of them.
 *
 * Copy is a local fixture rather than the real locale: these assert the
 * composition (`"Updated" + relative bucket`), not the English wording.
 */
const TRANSLATIONS = {
  header: {
    updatedAt: "Updated {time}",
    createdAt: "Created {time}",
    updatedJustNow: "Updated just now",
    createdJustNow: "Created just now",
  },
  // Capitalised exactly as the real locales have it: these labels also render
  // standalone in saved blocks and comments, which is what the just-now case
  // below exists to work around.
  time: {
    justNow: "Just now",
    minutesAgo: "{minutes}m ago",
    hoursAgo: "{hours}h ago",
    daysAgo: "{days}d ago",
  },
} as unknown as Translations;

const NOW = new Date("2026-08-19T12:00:00.000Z");

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function mountStamp(
  props: { iso: string; kind?: "updatedAt" | "createdAt" },
) {
  return mountEditor(TemplateTimestamp, {
    props: { iso: props.iso, kind: props.kind ?? "updatedAt" },
    provides: { [TRANSLATIONS_KEY]: TRANSLATIONS },
  });
}

function label(wrapper: ReturnType<typeof mountStamp>) {
  return wrapper.find('[data-testid="template-timestamp"]');
}

describe("TemplateTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("wording", () => {
    it("labels an updatedAt value as updated", () => {
      const wrapper = mountStamp({ iso: ago(5 * 60_000), kind: "updatedAt" });

      expect(label(wrapper).text()).toBe("Updated 5m ago");
    });

    it("labels a createdAt fallback as created, never as updated", () => {
      // The store said when it made the template, not when it changed it.
      const wrapper = mountStamp({ iso: ago(3 * 3_600_000), kind: "createdAt" });

      expect(label(wrapper).text()).toBe("Created 3h ago");
    });

    it("uses a standalone phrase for the just-now bucket", () => {
      // Composing the shared label would read "Updated Just now" — the bucket is
      // capitalised because saved blocks and comments render it on its own.
      const wrapper = mountStamp({ iso: ago(20_000) });

      expect(label(wrapper).text()).toBe("Updated just now");
      expect(label(wrapper).text()).not.toContain("Just now");
    });

    it("uses the created phrasing for a just-now createdAt", () => {
      const wrapper = mountStamp({ iso: ago(20_000), kind: "createdAt" });

      expect(label(wrapper).text()).toBe("Created just now");
    });

    it("uses the day bucket past 24 hours", () => {
      const wrapper = mountStamp({ iso: ago(3 * 86_400_000) });

      expect(label(wrapper).text()).toBe("Updated 3d ago");
    });
  });

  describe("values it refuses to render", () => {
    it("renders nothing for a value that does not parse", () => {
      const wrapper = mountStamp({ iso: "not-a-date" });

      expect(label(wrapper).exists()).toBe(false);
      expect(wrapper.text()).toBe("");
    });

    it("renders nothing for a value further ahead than clock skew explains", () => {
      const wrapper = mountStamp({ iso: ago(-10 * 60_000) });

      expect(label(wrapper).exists()).toBe(false);
    });

    it("still renders a value inside the skew tolerance", () => {
      // A server a few seconds ahead of the browser is ordinary, and hiding the
      // line for it would look like the store lost the timestamp.
      const wrapper = mountStamp({ iso: ago(-20_000) });

      expect(label(wrapper).text()).toBe("Updated just now");
    });
  });

  describe("the absolute date", () => {
    it("carries the full date in a tooltip", () => {
      const iso = ago(5 * 60_000);
      const wrapper = mountStamp({ iso });

      expect(label(wrapper).attributes("title")).toBe(
        new Date(iso).toLocaleString(),
      );
    });
  });

  describe("keeping up with the clock", () => {
    it("re-reads the clock on its interval", async () => {
      const wrapper = mountStamp({ iso: ago(30_000) });
      expect(label(wrapper).text()).toBe("Updated just now");

      // One tick later the same timestamp is 90s old. Without the tick the
      // label would still read "just now" for the rest of the session.
      vi.advanceTimersByTime(60_000);
      await nextTick();

      expect(label(wrapper).text()).toBe("Updated 1m ago");
    });

    it("stops ticking once unmounted", async () => {
      const wrapper = mountStamp({ iso: ago(30_000) });
      wrapper.unmount();

      // A surviving interval would keep writing to a disposed scope.
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
