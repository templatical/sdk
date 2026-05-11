// Minimal OSS-only consumer surface: import the editor and the optional
// renderer (for `editor.toMjml()`). No cloud, no media-library, no quality.
// This mirrors the Aurelia / vanilla-JS consumer in issue #63.
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import "@templatical/renderer";

export async function mount(container) {
  return init({ container });
}
