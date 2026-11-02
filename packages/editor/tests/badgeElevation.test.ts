// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ref } from "vue";
import { compile } from "tailwindcss";
import { mountEditor } from "./helpers/mount";
import BlockIssueBadge from "../src/components/canvas/BlockIssueBadge.vue";
import LocaleStatusChip from "../src/components/localization/LocaleStatusChip.vue";
import { TEMPLATE_LINT_KEY } from "../src/keys";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
});

const lift = "0 1px 2px rgb(1, 2, 3)";
const focusRing = "0 0 0 3px rgb(4, 5, 6)";

async function badgeStyles(kind: "issue" | "locale") {
  const wrapper =
    kind === "issue"
      ? mountEditor(BlockIssueBadge, {
          attachTo: document.body,
          props: { blockId: "title" },
          provides: {
            [TEMPLATE_LINT_KEY]: {
              issues: ref([
                {
                  blockId: "title",
                  severity: "warning",
                  ruleId: "a11y.image-missing-alt",
                },
              ]),
            },
          },
        })
      : mountEditor(LocaleStatusChip, {
          attachTo: document.body,
          props: {
            blockId: "title",
            state: "missing",
            count: 1,
            stale: [],
            setPaths: [],
            staleLocales: [],
            excerpt: "",
            eligibleGaps: false,
            editable: false,
          },
        });
  cleanups.push(() => wrapper.unmount());
  const badge = wrapper.get(kind === "issue" ? "[role=img]" : "button")
    .element as HTMLElement;
  const compiler = await compile(
    "@theme prefix(tpl) { --spacing: 0.25rem; } @tailwind utilities;",
  );
  const sheet = document.createElement("style");
  // Happy DOM cannot drive pointer/keyboard pseudo-classes or parse a layer
  // order statement. Keep Tailwind's real cascade and substitute state markers.
  sheet.textContent = compiler
    .build([...badge.classList])
    .replace("@layer properties;", "")
    .replace(/(?<!\\):hover\b/g, "[data-test-hover]")
    .replace(/(?<!\\):focus-visible\b/g, "[data-test-focus-visible]")
    .replaceAll("@media (hover: hover)", "@media all");
  document.head.append(sheet);
  cleanups.push(() => sheet.remove());
  badge.style.setProperty("--tpl-shadow-sm", lift);
  badge.style.setProperty("--tpl-ring", focusRing);
  badge.style.setProperty("--tpl-bg", "rgb(10, 20, 30)");
  badge.style.setProperty("--tpl-border", "rgb(40, 50, 60)");
  return {
    state(hover: boolean, focusVisible = false) {
      badge.toggleAttribute("data-test-hover", hover);
      badge.toggleAttribute("data-test-focus-visible", focusVisible);
      return getComputedStyle(badge);
    },
  };
}

describe("canvas badge elevation", () => {
  it.each(["issue", "locale"] as const)(
    "keeps the %s badge flat at rest with its fill and border ring, then lifts on hover",
    async (kind) => {
      const badge = await badgeStyles(kind);
      const resting = badge.state(false);
      expect(resting.getPropertyValue("--tw-shadow")).toBe("");
      expect(resting.backgroundColor).toBe("rgb(10, 20, 30)");
      expect(resting.getPropertyValue("--tw-ring-color")).toBe(
        "rgb(40, 50, 60)",
      );
      expect(resting.boxShadow).toContain("0 0 0 calc(1px");
      const hovered = badge.state(true);
      expect(hovered.getPropertyValue("--tw-shadow")).toBe(lift);
      expect(hovered.boxShadow).toContain("0 0 0 calc(1px");
      expect(hovered.boxShadow).toContain(lift);
    },
  );

  it("keeps the locale chip's keyboard focus halo when hovered", async () => {
    const badge = await badgeStyles("locale");
    expect(badge.state(false, true).getPropertyValue("--tw-shadow")).toBe(
      focusRing,
    );
    const focusedHover = badge.state(true, true);
    expect(focusedHover.getPropertyValue("--tw-shadow")).toBe(
      `${focusRing}, ${lift}`,
    );
    expect(focusedHover.boxShadow).toContain(focusRing);
    expect(focusedHover.boxShadow).toContain(lift);
    expect(focusedHover.boxShadow).toContain("0 0 0 calc(1px");
  });
});
