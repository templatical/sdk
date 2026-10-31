// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CustomBlockIcon from "../src/components/CustomBlockIcon.vue";

describe("CustomBlockIcon SVG", () => {
  it("keeps a path and removes executable SVG content before v-html", () => {
    const wrapper = mount(CustomBlockIcon, {
      props: {
        icon: '<svg viewBox="0 0 20 20" onload="window.fire()"><path d="M0 0L20 20"></path><foreignObject><p>bad</p></foreignObject></svg>',
      },
    });
    expect(wrapper.find("svg path").exists()).toBe(true);
    expect(wrapper.find("svg").attributes("onload")).toBeUndefined();
    expect(wrapper.find("foreignObject").exists()).toBe(false);
  });
});
