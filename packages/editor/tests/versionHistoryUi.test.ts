// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { POPOVER_ROOT_KEY } from "../src/keys";
import type { TemplateVersion } from "@templatical/types";
import VersionHistoryMenu from "../src/components/VersionHistoryMenu.vue";
import VersionPreviewBanner from "../src/components/VersionPreviewBanner.vue";
import RestoreVersionDialog from "../src/components/RestoreVersionDialog.vue";
import { mountEditor } from "./helpers/mount";

/**
 * The two shared surfaces version history renders. Both are shared rather than
 * cloud-only, and read the `TemplateVersion` contract rather than any backend's
 * wire shape.
 *
 * The arrow logic is the part worth pinning: it steps through the provider's
 * order, and its position is *derived* from what is actually previewed. A local
 * index went stale the moment the user cancelled a preview, so the arrows then
 * stepped from wherever they had left off instead of from the top.
 */

function version(
  id: string,
  overrides: Partial<TemplateVersion> = {},
): TemplateVersion {
  return { id, createdAt: "2026-08-16T10:00:00Z", ...overrides };
}

const VERSIONS = [version("ver-3"), version("ver-2"), version("ver-1")];

function mountMenu(props: Partial<Record<string, unknown>> = {}) {
  return mountEditor(VersionHistoryMenu, {
    props: {
      versions: VERSIONS,
      isLoading: false,
      isRestoring: false,
      previewingId: null,
      ...props,
    },
  });
}

describe("VersionHistoryMenu", () => {
  describe("the dropdown", () => {
    it("asks for a refresh on every open, not only when empty", async () => {
      const wrapper = mountMenu();

      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      // Two opens, two refreshes — history grows behind the user's back, so a
      // list fetched once would go stale silently.
      expect(wrapper.emitted("open")).toHaveLength(2);
    });

    it("lists every version in the provider's order", async () => {
      const wrapper = mountMenu();
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      const entries = wrapper.findAll('[data-testid="version-history-entry"]');
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.attributes("data-version-id"))).toEqual([
        "ver-3",
        "ver-2",
        "ver-1",
      ]);
    });

    it("shows the empty state rather than a spinner once a load has landed", async () => {
      const wrapper = mountMenu({ versions: [] });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(
        wrapper.find('[data-testid="version-history-empty"]').exists(),
      ).toBe(true);
    });

    it("shows a spinner on a first load, not the empty state", async () => {
      const wrapper = mountMenu({ versions: [], isLoading: true });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(
        wrapper.find('[data-testid="version-history-empty"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[role="status"]').attributes("aria-busy")).toBe(
        "true",
      );
    });

    it("emits the chosen version and closes", async () => {
      const wrapper = mountMenu();
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");
      await wrapper.find('[data-version-id="ver-2"]').trigger("click");

      expect(wrapper.emitted("navigate")?.[0][0]).toEqual(version("ver-2"));
      await nextTick();
      expect(
        wrapper.find('[data-testid="version-history-dropdown"]').exists(),
      ).toBe(false);
    });

    it("marks the previewed entry", async () => {
      const wrapper = mountMenu({ previewingId: "ver-2" });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(wrapper.find('[data-version-id="ver-2"]').classes()).toContain(
        "tpl:bg-[var(--tpl-bg-active)]",
      );
      expect(wrapper.find('[data-version-id="ver-3"]').classes()).toContain(
        "tpl:border-l-transparent",
      );
    });
  });

  describe("stepping", () => {
    it("starts at the newest when nothing is previewed", async () => {
      const wrapper = mountMenu();
      const older = wrapper.find('[data-testid="version-history-older"]');
      const newer = wrapper.find('[data-testid="version-history-newer"]');

      expect(older.attributes("disabled")).toBeUndefined();
      expect(newer.attributes("disabled")).toBeDefined();

      await older.trigger("click");
      expect(wrapper.emitted("navigate")?.[0][0]).toEqual(version("ver-3"));
    });

    it("steps from the previewed version, in both directions", async () => {
      const wrapper = mountMenu({ previewingId: "ver-2" });

      await wrapper.find('[data-testid="version-history-older"]').trigger("click");
      expect(wrapper.emitted("navigate")?.[0][0]).toEqual(version("ver-1"));

      await wrapper.find('[data-testid="version-history-newer"]').trigger("click");
      expect(wrapper.emitted("navigate")?.[1][0]).toEqual(version("ver-3"));
    });

    it("cannot step past either end", async () => {
      const oldest = mountMenu({ previewingId: "ver-1" });
      expect(
        oldest.find('[data-testid="version-history-older"]').attributes("disabled"),
      ).toBeDefined();

      const newest = mountMenu({ previewingId: "ver-3" });
      expect(
        newest.find('[data-testid="version-history-newer"]').attributes("disabled"),
      ).toBeDefined();
    });

    it("returns to the top once a preview is cancelled", async () => {
      const wrapper = mountMenu({ previewingId: "ver-1" });
      await wrapper.setProps({ previewingId: null });

      // Position is derived, so cancelling resets it — a locally tracked index
      // would still be sitting on the oldest entry.
      await wrapper.find('[data-testid="version-history-older"]').trigger("click");
      expect(wrapper.emitted("navigate")?.[0][0]).toEqual(version("ver-3"));
    });

    it("is inert while a restore is in flight", () => {
      const wrapper = mountMenu({ previewingId: "ver-2", isRestoring: true });
      expect(
        wrapper.find('[data-testid="version-history-older"]').attributes("disabled"),
      ).toBeDefined();
      expect(
        wrapper.find('[data-testid="version-history-newer"]').attributes("disabled"),
      ).toBeDefined();
    });
  });

  describe("entry labels", () => {
    it("badges an automatic version", async () => {
      const wrapper = mountMenu({
        versions: [version("ver-1", { isAutomatic: true })],
      });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(wrapper.find('[data-version-id="ver-1"]').text()).toContain(
        "versionHistory.auto",
      );
    });

    it("leads with a label when the store supplied one", async () => {
      const wrapper = mountMenu({
        versions: [version("ver-1", { label: "Before launch" })],
      });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(wrapper.find('[data-version-id="ver-1"]').text()).toContain(
        "Before launch",
      );
    });

    it("shows the author when the store tracks one", async () => {
      const wrapper = mountMenu({
        versions: [version("ver-1", { author: { name: "Ada" } })],
      });
      await wrapper.find('[data-testid="version-history-toggle"]').trigger("click");

      expect(wrapper.find('[data-version-id="ver-1"]').text()).toContain("Ada");
    });
  });
});

describe("VersionPreviewBanner", () => {
  it("renders nothing while invisible", () => {
    const wrapper = mountEditor(VersionPreviewBanner, {
      props: { visible: false, canRestore: true },
    });
    expect(
      wrapper.find('[data-testid="version-preview-banner"]').exists(),
    ).toBe(false);
  });

  it("offers both actions when the provider allows restoring", async () => {
    const wrapper = mountEditor(VersionPreviewBanner, {
      props: { visible: true, canRestore: true },
    });

    await wrapper.find('[data-testid="version-preview-restore"]').trigger("click");
    await wrapper.find('[data-testid="version-preview-cancel"]').trigger("click");

    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("hides Restore entirely when the provider withheld it", () => {
    const wrapper = mountEditor(VersionPreviewBanner, {
      props: { visible: true, canRestore: false },
    });

    // Hidden, not disabled — the same discipline saved blocks uses: an action
    // the store refused should not look like one you could take.
    expect(
      wrapper.find('[data-testid="version-preview-restore"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="version-preview-cancel"]').exists()).toBe(
      true,
    );
  });
});

/**
 * The restore confirmation. It exists because `confirmRestore()` throws away the
 * pre-preview backup — so the two shapes it can take are the whole point: an
 * offer to put the unsaved work somewhere real, or an honest warning when there
 * is nowhere to put it.
 */
describe("RestoreVersionDialog", () => {
  let popoverRootEl: HTMLElement;

  beforeEach(() => {
    popoverRootEl = document.createElement("div");
    popoverRootEl.className = "tpl-popover-root";
    document.body.appendChild(popoverRootEl);
  });

  afterEach(() => {
    popoverRootEl.remove();
  });

  function q<T extends Element = HTMLElement>(sel: string): T | null {
    return popoverRootEl.querySelector<T>(sel);
  }

  function mountDialog(props: { canSave?: boolean; isBusy?: boolean } = {}) {
    return mountEditor(RestoreVersionDialog, {
      props: {
        visible: true,
        canSave: props.canSave ?? true,
        isBusy: props.isBusy ?? false,
      },
      attachTo: document.body,
      provides: {
        [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      },
    } as never);
  }

  it("renders nothing while invisible", () => {
    mountEditor(RestoreVersionDialog, {
      props: { visible: false, canSave: true, isBusy: false },
      attachTo: document.body,
      provides: {
        [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      },
    } as never);

    expect(q('[data-testid="restore-version-dialog"]')).toBe(null);
  });

  it("offers to save first, and says so, when there is somewhere to save", () => {
    mountDialog({ canSave: true });

    expect(q('[data-testid="restore-version-save-first"]')).not.toBe(null);
    expect(
      q('[data-testid="restore-version-dialog"]')!.textContent,
    ).toContain("versionPreview.restoreConfirm.unsavedWithSave");
  });

  it("warns without offering when there is nowhere to save", () => {
    mountDialog({ canSave: false });

    // Hidden, not disabled: an action the editor cannot perform should not look
    // like one you could take.
    expect(q('[data-testid="restore-version-save-first"]')).toBe(null);
    expect(
      q('[data-testid="restore-version-dialog"]')!.textContent,
    ).toContain("versionPreview.restoreConfirm.unsavedNoSave");
    // Restoring is still reachable — the warning is a warning, not a block.
    expect(q('[data-testid="restore-version-discard"]')).not.toBe(null);
  });

  it("emits one event per action", async () => {
    const wrapper = mountDialog();

    q<HTMLButtonElement>('[data-testid="restore-version-save-first"]')!.click();
    q<HTMLButtonElement>('[data-testid="restore-version-discard"]')!.click();
    q<HTMLButtonElement>('[data-testid="restore-version-cancel"]')!.click();
    await nextTick();

    expect(wrapper.emitted("save-and-restore")).toHaveLength(1);
    expect(wrapper.emitted("discard-and-restore")).toHaveLength(1);
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("goes inert while an action is in flight", () => {
    mountDialog({ isBusy: true });

    for (const testid of [
      "restore-version-cancel",
      "restore-version-discard",
      "restore-version-save-first",
    ]) {
      expect(
        q<HTMLButtonElement>(`[data-testid="${testid}"]`)!.disabled,
      ).toBe(true);
    }
  });
});
