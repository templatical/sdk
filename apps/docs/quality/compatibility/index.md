---
description: Check pass-through HTML and CSS against caniemail client support data, and measure compiled HTML for Gmail clipping.
---

# Compatibility linter

`lintCompatibility(content, options?)` flags client-breaking HTML and CSS in authored pass-through content. These rules flag HTML and CSS that the renderer passes through unchanged and that major email clients don't support, using data from caniemail.com. The renderer's own output is MJML's job and isn't checked.

The bundled [caniemail snapshot](https://www.caniemail.com/) was updated **2026-09-16**. Support verdicts use the last-listed test for each client platform. A warning means at least one listed client cannot use the detected feature; info means only partial support remains. The [rule catalog](./rule-catalog) gives triggers, exceptions, and sources. `<script>` and `<iframe>` warnings are hand-written because caniemail has no tests for them.

## What is scanned

The linter reads authored `html`, paragraph and title content, table-cell content, and custom blocks' `renderedHtml` and `renderedStylesheet`. It also checks image `src`, video `thumbnailUrl`, and section, section-wrapper and wrapper-block background image URLs for base64 images. CSS inside style attributes, `<style>` elements and custom stylesheets is included. One issue per rule and block carries a `suggestion`, `reference`, and, for data-backed findings, affected `clients` and a short `excerpt`.

It does not inspect MJML's generated output. The Outlook background checks in `structure.*` remain structure rules because they concern SDK layout fields. Linked SVG, WebP and AVIF images are left to the existing image guidance; their rendering depends on the image host and client.

## API and options

```ts
import { readFile } from "node:fs/promises";
import { lintCompatibility, lintHtmlFragment } from "@templatical/quality";

const content = JSON.parse(await readFile("template.json", "utf8"));
const issues = lintCompatibility(content);
const fragmentIssues = lintHtmlFragment('<div style="display:flex">Hi</div>', {
  stylesheet: ".card { position: absolute }",
  locale: "en",
});
```

`lintTemplate` runs compatibility after accessibility, structure, links and deliverability, then runs localization. Set `compatibility: false` to disable the category, or set a rule to `"off"` in `compatibility.rules`. `compatibility.thresholds.maxHtmlBytes` defaults to `92_160` bytes (90 KiB). Every category, including `localization`, must be `false` to prevent the editor's optional quality chunk from loading; use `localization: false` alongside the other category flags.

`lintCompiledHtml(html, options?)` measures UTF-8 bytes and flags `compat.gmail-clipping` only when the compiled HTML exceeds that threshold. Google does not publish a clipping threshold; community tests in [email-bugs#41](https://github.com/hteumeuleu/email-bugs/issues/41) show Gmail clipping at **about 102 KB**, and sometimes earlier once a sending service adds its markup. The default margin allows for tracking links added by sending services. Quality never renders or compiles HTML itself:

```ts
import { readFile } from "node:fs/promises";
import { renderToMjml } from "@templatical/renderer";
import { lintCompiledHtml } from "@templatical/quality";
import mjml2html from "mjml";

const content = JSON.parse(await readFile("template.json", "utf8"));
const mjml = await renderToMjml(content);
const html = (await mjml2html(mjml, { validationLevel: "soft" })).html;
const sizeIssues = lintCompiledHtml(html);
```

Install `mjml` separately for this example. In the editor, the Issues panel shows an **Email size** section when its render provider implements `toHtml` or `compileMjml`. It explains that Gmail cuts off emails over about 102 KB. Choose **Check size** to measure the compiled HTML. A passing result shows the size and confirms Gmail will show the whole email; an oversized result shows the size and a clipping warning in the issues list. After an edit, the last size remains visible with an out-of-date message and the button changes to **Check again**. Cloud mode does not show this section because its current HTML render path saves first.

## Check it

Save this template as `template.json`:

```json
{"blocks":[{"id":"html_1","type":"html","content":"<svg width=\"40\" height=\"40\"><circle cx=\"20\" cy=\"20\" r=\"18\"/></svg>","styles":{"padding":{"top":10,"right":10,"bottom":10,"left":10}}}],"settings":{"width":600,"backgroundColor":"#ffffff","textColor":"#1a1a1a","linkUnderline":true,"fontFamily":"Arial","locale":"en"}}
```

```bash
npx @templatical/template-tools validate template.json --html --json
```

With the optional `mjml` package installed, the built CLI exits `0` and reports `htmlBytes: 4181`. Its output includes this issue (selected fields from the actual result):

```json
{"blockId":"html_1","ruleId":"compat.html-svg","severity":"warning","suggestion":"Use a PNG or JPEG image instead.","reference":"https://www.caniemail.com/features/html-svg/","excerpt":"<svg>"}
```

`--html` compiles once; without `mjml`, it exits `3` with the install hint before producing output. Compatibility warnings and info never make a structurally valid template exit `1`.
