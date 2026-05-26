// @vitest-environment happy-dom
import "./dom-stubs";

import { describe, expect, it } from "vitest";
import MergeTagInsertButton from "../src/components/MergeTagInsertButton.vue";
import { mountEditor } from "./helpers/mount";

function clickCount(button: HTMLElement): number {
  // helper read for clarity at assertion sites
  return Number(button.getAttribute("data-tpl-click-count") ?? "0");
}

describe("MergeTagInsertButton", () => {
  it("renders the insert merge tag affordance", () => {
    const wrapper = mountEditor(MergeTagInsertButton, {
      attachTo: document.body,
    });
    const btn = wrapper.element as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("aria-label")).toBeTruthy();
  });

  it("emits 'insert' exactly once per click", async () => {
    const wrapper = mountEditor(MergeTagInsertButton, {
      attachTo: document.body,
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("insert")).toBeTruthy();
    expect(wrapper.emitted("insert")!.length).toBe(1);
    void clickCount; // silence unused
  });

  it("is enabled by default", () => {
    const wrapper = mountEditor(MergeTagInsertButton, {
      attachTo: document.body,
    });
    const btn = wrapper.element as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("respects the disabled prop", () => {
    const wrapper = mountEditor(MergeTagInsertButton, {
      props: { disabled: true },
      attachTo: document.body,
    });
    const btn = wrapper.element as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("does not emit when clicked while disabled (native HTML semantics)", async () => {
    // The browser suppresses click events on disabled buttons. Asserting on
    // the native behavior keeps the parent's gating logic honest — callers
    // don't need to wrap clicks in additional checks.
    const wrapper = mountEditor(MergeTagInsertButton, {
      props: { disabled: true },
      attachTo: document.body,
    });
    const btn = wrapper.element as HTMLButtonElement;
    btn.click();
    expect(wrapper.emitted("insert")).toBeFalsy();
  });
});
