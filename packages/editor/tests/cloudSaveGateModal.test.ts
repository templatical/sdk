// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CloudSaveGateModal from "../src/cloud/components/CloudSaveGateModal.vue";
import { CLOUD_TRANSLATIONS_KEY } from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";
import type { LintIssue } from "../src/composables/useTemplateLint";

const issues: LintIssue[] = [
  {
    ruleId: "a11y.missing-alt",
    severity: "error",
    message: "Image is missing alt text",
    blockId: "img-1",
  },
  {
    ruleId: "a11y.missing-preheader",
    severity: "error",
    message: "Template is missing a preheader",
  },
];

function mountGate(open = true) {
  return mount(CloudSaveGateModal, {
    props: { open, issues },
    global: {
      provide: { [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn },
      stubs: {
        TplModal: {
          props: ["visible"],
          emits: ["close"],
          template:
            '<div v-if="visible" data-testid="tpl-modal-stub"><slot /><button data-testid="tpl-modal-close" type="button" @click="$emit(\'close\')" /></div>',
        },
      },
    },
  });
}

describe("CloudSaveGateModal", () => {
  it("lists the blocking issues and names the dialog", () => {
    const wrapper = mountGate();
    expect(
      wrapper.get('[role="alertdialog"]').attributes("aria-labelledby"),
    ).toBe("tpl-save-gate-title");
    expect(wrapper.text()).toContain(cloudEn.saveGate.title);
    expect(wrapper.text()).toContain("Image is missing alt text");
    expect(wrapper.text()).toContain("a11y.missing-alt");
    expect(wrapper.text()).toContain("a11y.missing-preheader");
  });

  it("emits cancel, confirm, and close-from-the-backdrop", async () => {
    const wrapper = mountGate();
    await wrapper
      .get('[data-testid="cloud-save-gate-cancel"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="cloud-save-gate-confirm"]')
      .trigger("click");
    await wrapper.get('[data-testid="tpl-modal-close"]').trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(2);
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });

  it("renders nothing while closed", () => {
    const wrapper = mountGate(false);
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
  });
});
