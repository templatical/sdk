import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createParagraphBlock,
  createMenuBlock,
  createDefaultTemplateContent,
  generateId,
} from "@templatical/types";
import { renderToMjml } from "../src";

describe("scratch: does global underline hit buttons?", () => {
  it("inspects compiled anchors when linkUnderline=true", async () => {
    const content = createDefaultTemplateContent();
    content.settings.linkUnderline = true;
    content.blocks = [
      createButtonBlock({ text: "BUTTONLABEL", url: "https://x.com" }),
      createParagraphBlock({
        content: '<p><a href="https://x.com">PARALINK</a></p>',
      }),
      createMenuBlock({
        items: [{ id: generateId(), text: "MENULINK", url: "https://x.com" }],
      } as Parameters<typeof createMenuBlock>[0]),
    ];
    const { html } = await mjml2html(await renderToMjml(content));
    const lines: string[] = [];
    for (const label of ["BUTTONLABEL", "PARALINK", "MENULINK"]) {
      const m = new RegExp(`<a\\b[^>]*>[^<]*${label}`, "i").exec(html);
      lines.push(`=== ${label} ===\n${m ? m[0] : "NOT FOUND"}\n`);
    }
    writeFileSync(
      "/private/tmp/claude-501/-Users-orkhanahmadov-Sites-templatical-sdk/dc4283aa-0810-4c07-b5cd-5562a362694b/scratchpad/anchors.txt",
      lines.join("\n"),
    );
  });
});
