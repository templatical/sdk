import { createDefaultTemplateContent } from "@templatical/types";
import { mediaProviderFor } from "../../host/providers";
import type { Scene } from "../types";

export const media: Scene = {
  id: "media",
  title: "Media",
  job: "Upload and pick an image",
  initKey: "media",
  summary:
    "init({ media }) — Browse, drop-upload, and a seeded localStorage gallery.",
  affordance: "media",
  catalog: "oss",
  group: "backend",
  docs: "/backend/media",
  content: () => createDefaultTemplateContent(),
  config: () => ({
    media: mediaProviderFor(),
  }),
  snippet: `import { init, createLocalStorageMediaProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  media: createLocalStorageMediaProvider({
    key: "templatical:media",
  }),
});`,
};
