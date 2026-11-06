// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CollapsibleSection from "../src/components/toolbar/CollapsibleSection.vue";

describe("CollapsibleSection", () => {
  it("marks its content with the header test id plus -content", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "Background", open: true, headerTestId: "panel-bg" },
      slots: { default: "<p>Body</p>" },
    });
    expect(wrapper.get('[data-testid="panel-bg"]').text()).toBe("Background");
    expect(wrapper.get('[data-testid="panel-bg-content"]').text()).toBe("Body");
  });

  it("adds no content test id without a header test id", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "Background", open: true },
      slots: { default: "<p>Body</p>" },
    });
    expect(wrapper.find("[data-testid]").exists()).toBe(false);
  });
});
