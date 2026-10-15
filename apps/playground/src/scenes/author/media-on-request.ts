import {
  createDefaultTemplateContent,
  type MediaRequestContext,
  type MediaResult,
} from "@templatical/types";
import type { Scene } from "../types";

interface HostImage {
  path: string;
  alt: string;
}

/** The host's own library: it never touches the editor's media store. */
const HOST_IMAGES: HostImage[] = [
  {
    path: "/examples/sable/headphones.png",
    alt: "Sable Wireless Pro Max headphones",
  },
  { path: "/examples/sable/speaker.png", alt: "Sable Boom Speaker" },
  { path: "/examples/sable/watch.png", alt: "Sable Chrono Smart watch" },
  {
    path: "/examples/northstage/banner.png",
    alt: "Northstage Summit event banner",
  },
  {
    path: "/examples/northstage/abstract.png",
    alt: "Northstage hall lighting",
  },
  { path: "/examples/flowwork/team.png", alt: "Flowwork team in the studio" },
];

/**
 * Stands in for an upload: a `data:` URL survives export, where the
 * session-local `blob:` URL from `URL.createObjectURL` would not. A file that
 * cannot be read resolves to null, which leaves the field as it was.
 */
function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function openHostPicker(): Promise<MediaResult | null> {
  return new Promise((resolve) => {
    document.querySelector("[data-media-on-request]")?.remove();

    const backdrop = document.createElement("div");
    backdrop.setAttribute("data-media-on-request", "");
    backdrop.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:10000";

    const finish = (result: MediaResult | null) => {
      window.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(null);
    };
    window.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("data-testid", "playground-media-modal");
    dialog.style.cssText =
      "background:#fff;color:#111;width:min(480px,calc(100vw - 32px));max-height:480px;overflow:auto;padding:12px;border-radius:8px";

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.style.cssText = "display:block;margin:0 0 8px auto";
    close.addEventListener("click", () => finish(null));
    dialog.append(close);

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(3,1fr);gap:8px";
    for (const image of HOST_IMAGES) {
      // Absolute, so the URL still resolves once the email leaves this page.
      const url = new URL(image.path, window.location.origin).href;
      const button = document.createElement("button");
      button.type = "button";
      button.style.cssText =
        "padding:0;border:1px solid #ddd;border-radius:6px;background:#fff;overflow:hidden;cursor:pointer";
      const img = document.createElement("img");
      img.src = url;
      img.alt = image.alt;
      img.style.cssText =
        "display:block;width:100%;aspect-ratio:4/3;object-fit:cover";
      button.append(img);
      button.addEventListener("click", () => finish({ url, alt: image.alt }));
      grid.append(button);
    }
    dialog.append(grid);

    backdrop.append(dialog);
    document.body.append(backdrop);
  });
}

/**
 * Browse opens the host's picker; a file dropped on an image field arrives in
 * `files` and is "uploaded" without one.
 */
async function onRequestMedia(
  context?: MediaRequestContext,
): Promise<MediaResult | null> {
  const file = context?.files?.[0];
  if (file) {
    const url = await readAsDataUrl(file);
    return url ? { url } : null;
  }
  return openHostPicker();
}

export const mediaOnRequest: Scene = {
  id: "media-on-request",
  title: "Media on request",
  job: "Pick images in your own UI",
  initKey: "onRequestMedia",
  summary:
    "init({ onRequestMedia }) — a host-owned picker replaces the media library.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/images#browse-and-pick",
  pointer: {
    selector: '[data-palette-type="image"]',
    root: "editor",
    side: "right",
    replaces: "palette",
  },
  content: () => createDefaultTemplateContent(),
  config: () => ({
    onRequestMedia,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  onRequestMedia: async (context) => {
    // A file was dropped on an image field: upload it, return its URL
    if (context?.files?.length) {
      return { url: await uploadToYourBackend(context.files[0]) };
    }
    // Browse Media: open your own picker; return { url, alt } or null
    return await yourMediaPicker();
  },
});`,
};
