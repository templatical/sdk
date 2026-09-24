// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CloudErrorOverlay from "../src/cloud/components/CloudErrorOverlay.vue";
import { CLOUD_TRANSLATIONS_KEY } from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";

function mountOverlay(error: Error | null, visible = true) {
  return mount(CloudErrorOverlay, {
    props: { error, visible },
    global: {
      provide: { [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn },
    },
  });
}

describe("CloudErrorOverlay", () => {
  it("hides when not visible or there is no error", () => {
    expect(
      mountOverlay(new Error("x"), false).find('[role="alert"]').exists(),
    ).toBe(false);
    expect(mountOverlay(null, true).find('[role="alert"]').exists()).toBe(
      false,
    );
  });

  it("shows the default message and retries", async () => {
    const wrapper = mountOverlay(new Error("boom"));
    expect(wrapper.text()).toContain(cloudEn.error.title);
    expect(wrapper.text()).toContain(cloudEn.error.defaultMessage);
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("names an auth failure", () => {
    const err = Object.assign(new Error("401"), { isUnauthorized: true });
    const wrapper = mountOverlay(err);
    expect(wrapper.text()).toContain(cloudEn.error.authFailed);
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("hides retry when the template was not found", () => {
    const err = Object.assign(new Error("404"), { isNotFound: true });
    const wrapper = mountOverlay(err);
    expect(wrapper.text()).toContain(cloudEn.error.templateNotFound);
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
