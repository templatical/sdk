import { createCountdownBlock } from "@templatical/types";
import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

const SAMPLE_GIF = "https://play.templatical.com/countdown-sample.gif";

// The demo counts down to 18:00 Berlin time about thirty days ahead, so the
// canvas never opens on an expired countdown. The snippet writes the same
// expression rather than a literal date, which would go stale.
const DAY_MS = 86_400_000;

export function sampleTargetDate(now = Date.now()): string {
  const target = new Date(now + 30 * DAY_MS);
  return `${target.toISOString().slice(0, 10)}T18:00`;
}

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
        targetDate: sampleTargetDate(),
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

// 18:00 Berlin time, about thirty days ahead.
const target = new Date(Date.now() + 30 * 86_400_000);

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: \`\${target.toISOString().slice(0, 10)}T18:00\`,
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
