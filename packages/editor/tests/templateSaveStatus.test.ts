// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import TemplateSaveStatus from "../src/components/TemplateSaveStatus.vue";
import { mountEditor } from "./helpers/mount";

function mountStatus(props: {
  status?: "idle" | "saved" | "error";
  errorMessage?: string;
  isDirty?: boolean;
}) {
  return mountEditor(TemplateSaveStatus, {
    props: {
      status: props.status ?? "idle",
      errorMessage: props.errorMessage ?? "",
      isDirty: props.isDirty ?? false,
    },
  });
}

describe("TemplateSaveStatus", () => {
  it("renders nothing when idle and clean", () => {
    const wrapper = mountStatus({});

    expect(wrapper.find('[data-testid="save-status-error"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="save-status-saved"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="save-status-unsaved"]').exists()).toBe(
      false,
    );
  });

  it("shows the unsaved state while dirty", () => {
    const wrapper = mountStatus({ isDirty: true });

    const badge = wrapper.find('[data-testid="save-status-unsaved"]');
    expect(badge.text()).toBe("header.unsaved");
    expect(badge.attributes("aria-live")).toBe("polite");
  });

  it("shows the saved state", () => {
    const wrapper = mountStatus({ status: "saved" });

    const badge = wrapper.find('[data-testid="save-status-saved"]');
    expect(badge.text()).toBe("header.saved");
    expect(badge.attributes("aria-live")).toBe("polite");
  });

  it("shows the failure with the provider's message in a tooltip", () => {
    const wrapper = mountStatus({
      status: "error",
      errorMessage: "Storage is full",
    });

    const badge = wrapper.find('[data-testid="save-status-error"]');
    expect(badge.text()).toBe("header.saveFailed");
    expect(badge.attributes("data-tooltip")).toBe("Storage is full");
    // Assertive, not polite: a failed save needs acknowledging.
    expect(badge.attributes("aria-live")).toBe("assertive");
  });

  it("prefers the failure over a dirty flag", () => {
    const wrapper = mountStatus({
      status: "error",
      errorMessage: "nope",
      isDirty: true,
    });

    expect(wrapper.find('[data-testid="save-status-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="save-status-unsaved"]').exists()).toBe(
      false,
    );
  });

  it("prefers a fresh success over a dirty flag", () => {
    // A save clears `isDirty`, but an edit landing during it can set it again;
    // the confirmation still wins for its few seconds.
    const wrapper = mountStatus({ status: "saved", isDirty: true });

    expect(wrapper.find('[data-testid="save-status-saved"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="save-status-unsaved"]').exists()).toBe(
      false,
    );
  });
});
