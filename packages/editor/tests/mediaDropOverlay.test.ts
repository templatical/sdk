// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h, provide } from "vue";
import MediaDropOverlay from "../src/components/MediaDropOverlay.vue";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
import { TRANSLATIONS_KEY } from "../src/keys";

function mountOverlay(props: {
  uploading: boolean;
  size?: "field" | "canvas";
}) {
  return mountEditor(MediaDropOverlay, {
    props,
    provides: { [TRANSLATIONS_KEY]: en },
  });
}

// happy-dom drops a `color-mix()` declaration from the style attribute, so
// the veil is read from server-rendered markup instead.
async function renderVeil(size?: "field" | "canvas"): Promise<string> {
  const { renderToString } = await import("vue/server-renderer");
  const App = defineComponent({
    setup() {
      provide(TRANSLATIONS_KEY, en);
      return () => h(MediaDropOverlay, { uploading: false, size });
    },
  });
  const html = await renderToString(h(App));
  return /style="([^"]*)"/.exec(html)![1];
}

describe("MediaDropOverlay", () => {
  it("invites a drop until an upload starts", () => {
    const wrapper = mountOverlay({ uploading: false });

    expect(wrapper.text()).toBe(en.image.dropToUpload);
    expect(wrapper.find(".lucide-upload").exists()).toBe(true);
    expect(wrapper.find(".tpl-spinner").exists()).toBe(false);
  });

  it("shows a spinner while the upload runs", () => {
    const wrapper = mountOverlay({ uploading: true });

    expect(wrapper.text()).toBe(en.image.uploading);
    expect(wrapper.find(".lucide-loader-circle").classes()).toContain(
      "tpl-spinner",
    );
    expect(wrapper.find(".lucide-upload").exists()).toBe(false);
  });

  it("draws at field size by default", async () => {
    const drop = mountOverlay({ uploading: false });
    const busy = mountOverlay({ uploading: true });

    expect(drop.classes()).toContain("tpl:gap-1.5");
    expect(drop.get("svg").attributes()).toMatchObject({
      width: "18",
      "stroke-width": "1.5",
    });
    expect(busy.get("svg").attributes()).toMatchObject({
      width: "18",
      "stroke-width": "2",
    });
    expect(await renderVeil()).toBe(
      "background-color:color-mix(in srgb, var(--tpl-bg) 90%, transparent);",
    );
  });

  it("draws larger on the canvas", async () => {
    const drop = mountOverlay({ uploading: false, size: "canvas" });
    const busy = mountOverlay({ uploading: true, size: "canvas" });

    expect(drop.classes()).toContain("tpl:gap-2");
    expect(drop.classes()).not.toContain("tpl:gap-1.5");
    expect(drop.get("svg").attributes()).toMatchObject({
      width: "20",
      "stroke-width": "1.5",
    });
    expect(busy.get("svg").attributes()).toMatchObject({
      width: "20",
      "stroke-width": "2",
    });
    expect(await renderVeil("canvas")).toBe(
      "background-color:color-mix(in srgb, var(--tpl-bg) 85%, transparent);",
    );
  });

  it("never takes pointer events from the field beneath", () => {
    const wrapper = mountOverlay({ uploading: false });

    expect(wrapper.classes()).toContain("tpl:pointer-events-none");
    expect(wrapper.classes()).toContain("tpl:absolute");
    expect(wrapper.classes()).toContain("tpl:inset-0");
  });
});
