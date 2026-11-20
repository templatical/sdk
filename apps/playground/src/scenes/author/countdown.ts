import { createCountdownBlock } from "@templatical/types";
import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

const SAMPLE_GIF = "https://play.templatical.com/countdown-sample.gif";

export const countdown: Scene = {
  id: "countdown",
  title: "Countdown",
  job: "Show a hosted countdown image",
  initKey: "countdown",
  summary:
    "init({ countdown: { imageUrl } }) — supply an image URL for countdown blocks.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/countdown",
  pointer: {
    selector: '[data-block-id="countdown-demo"]',
    root: "editor",
    side: "right",
  },
  content: () => {
    const content = setupBaseCanvas();
    content.blocks.splice(
      1,
      0,
      createCountdownBlock({
        id: "countdown-demo",
        targetDate: "2026-12-24T18:00:00+01:00",
        timezone: "Europe/Berlin",
      }),
    );
    return content;
  },
  config: () => ({
    countdown: { imageUrl: () => SAMPLE_GIF },
  }),
  snippet: `import { init } from "@templatical/editor";
import { createCountdownBlock, createDefaultTemplateContent } from "@templatical/types";
import "@templatical/editor/style.css";

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));

const editor = await init({
  container: document.getElementById("editor"),
  content,
  countdown: {
    imageUrl: () => "https://play.templatical.com/countdown-sample.gif",
  },
});`,
};
