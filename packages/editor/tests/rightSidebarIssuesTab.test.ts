// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { createDefaultTemplateContent } from "@templatical/types";
import RightSidebar from "../src/components/RightSidebar.vue";
import { TEMPLATE_LINT_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * `@templatical/quality` is an optional peer, loaded by a dynamic import when
 * the editor mounts. The Issues tab renders from mount and goes once that
 * import fails: the panel behind it has nothing to show without the package.
 */

function lintState(state: { ready: boolean; unavailable: boolean }) {
  return {
    issues: ref([]),
    ready: ref(state.ready),
    unavailable: ref(state.unavailable),
    applyFix: () => {},
    destroy: () => {},
  };
}

function mountSidebar(lint: ReturnType<typeof lintState> | null) {
  return mountEditor(RightSidebar, {
    props: {
      selectedBlock: null,
      settings: createDefaultTemplateContent().settings,
    },
    provides: lint === null ? {} : { [TEMPLATE_LINT_KEY]: lint },
  });
}

describe("RightSidebar Issues tab", () => {
  it("renders the tab once the quality package has loaded", () => {
    const wrapper = mountSidebar(lintState({ ready: true, unavailable: false }));
    expect(wrapper.find("#tpl-tab-issues").exists()).toBe(true);
  });

  it("renders no tab when the quality package is not installed", () => {
    const wrapper = mountSidebar(lintState({ ready: false, unavailable: true }));
    expect(wrapper.find("#tpl-tab-issues").exists()).toBe(false);
    expect(wrapper.find("#tpl-tabpanel-issues").exists()).toBe(false);
  });

  it("renders the tab while the quality package is still loading", () => {
    // Apps that install the package never see the tab pop in once it loads.
    const wrapper = mountSidebar(
      lintState({ ready: false, unavailable: false }),
    );
    expect(wrapper.find("#tpl-tab-issues").exists()).toBe(true);
  });

  it("removes the tab when the import fails", async () => {
    const lint = lintState({ ready: false, unavailable: false });
    const wrapper = mountSidebar(lint);
    expect(wrapper.find("#tpl-tab-issues").exists()).toBe(true);
    lint.unavailable.value = true;
    await nextTick();
    expect(wrapper.find("#tpl-tab-issues").exists()).toBe(false);
  });

  it("falls back to the Content tab when the import fails while Issues is open", async () => {
    // A tab picked while the import was in flight must not leave the sidebar
    // with no panel at all.
    const lint = lintState({ ready: false, unavailable: false });
    const wrapper = mountSidebar(lint);
    await wrapper.find("#tpl-tab-issues").trigger("click");
    expect(wrapper.find("#tpl-tabpanel-issues").exists()).toBe(true);
    lint.unavailable.value = true;
    await nextTick();
    expect(wrapper.find("#tpl-tabpanel-issues").exists()).toBe(false);
    expect(wrapper.find("#tpl-tabpanel-content").exists()).toBe(true);
    expect(
      wrapper.find("#tpl-tab-content").attributes("aria-selected"),
    ).toBe("true");
  });

  it("renders no tab when linting is turned off", () => {
    // useEditorCore provides no linter at all when every lint key is false.
    expect(mountSidebar(null).find("#tpl-tab-issues").exists()).toBe(false);
  });
});
