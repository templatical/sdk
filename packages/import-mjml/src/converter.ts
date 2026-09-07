import { load } from "cheerio";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import {
  buildAttributeCascade,
  childElements,
  findByTag,
  tagOf,
} from "./attribute-resolver";
import { convertElement } from "./block-mapper";
import type { ConvertContext } from "./block-base";
import { planSiblings } from "./display-condition";
import { extractSettings } from "./head-parser";
import { buildSection, buildWrapper } from "./section-builder";
import type { ImportReport, ImportReportEntry, ImportResult } from "./types";

const EMPTY_DOCUMENT_WARNING =
  "No convertible content was found in the MJML. Check that the document has an <mj-body> with at least one <mj-section>.";

/**
 * Wrap blocks that sat directly under `mj-body` in a one-column section.
 *
 * Valid MJML puts every block inside an `mj-section`, but hand-written and
 * machine-mangled documents do not, and the editor canvas has no
 * representation for a block outside a section.
 */
function wrapInSection(blocks: Block[]): Block {
  return createSectionBlock({
    columns: "1",
    children: [blocks],
    styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  });
}

function walkBody(
  $body: Cheerio<Element>,
  ctx: ConvertContext,
  entries: ImportReportEntry[],
): Block[] {
  const blocks: Block[] = [];
  let loose: Block[] = [];

  const flushLoose = () => {
    if (loose.length > 0) {
      blocks.push(wrapInSection(loose));
      loose = [];
    }
  };

  for (const unit of planSiblings(childElements($body, ctx.$))) {
    const tag = tagOf(unit.$el[0]);

    if (tag === "mj-wrapper" || tag === "mj-section") {
      flushLoose();
      const produced =
        tag === "mj-wrapper"
          ? buildWrapper(unit.$el, ctx, entries)
          : buildSection(unit.$el, ctx, entries);

      // A condition brackets one element, so it lands on every block that
      // element produced — which is more than one only for a multi-section
      // wrapper, where each band carries the same guard.
      for (const block of produced) {
        if (unit.displayCondition)
          block.displayCondition = unit.displayCondition;
        blocks.push(block);
      }
      continue;
    }

    const converted = convertElement(unit.$el, ctx);
    if (!converted) continue;
    entries.push(converted.entry);
    if (!converted.block) continue;

    if (unit.displayCondition) {
      converted.block.displayCondition = unit.displayCondition;
    }

    // An html fallback for a body-level element is already a top-level block;
    // wrapping it in a section would add nesting the source never had.
    if (converted.entry.status === "html-fallback") {
      flushLoose();
      blocks.push(converted.block);
      continue;
    }

    loose.push(converted.block);
  }

  flushLoose();
  return blocks;
}

/**
 * Convert an MJML document into a Templatical template.
 *
 * @example
 * ```ts
 * const { content, report } = convertMjmlTemplate(mjmlSource);
 *
 * const editor = init({ container: '#editor', content });
 *
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertMjmlTemplate(mjml: string): ImportResult {
  if (typeof mjml !== "string") {
    throw new Error(
      "Invalid MJML template: expected a string. Pass the raw MJML source as a string.",
    );
  }
  if (mjml.trim().length === 0) {
    throw new Error(
      "Invalid MJML template: input is empty. Pass the raw MJML source of an email.",
    );
  }

  // The `xml` option routes parsing through htmlparser2 rather than parse5, so
  // custom `mj-*` tags survive as generic elements and no implicit
  // <html><head><body> is injected around them. Two htmlparser2 options are
  // then overridden away from what `xml: true` alone would give:
  //
  // - `xmlMode: false` puts htmlparser2 in HTML mode, which knows the void
  //   element list (`br`, `img`, `hr`, …) and closes them immediately. In XML
  //   mode a bare `<br>` stays open and everything after it — including the
  //   rest of the paragraph — becomes ITS CHILD rather than its sibling. That
  //   shape is exactly what TipTap emits for a hard break and what browser DOM
  //   serialization produces, so it hits `<mj-text>` content routinely; a
  //   later HTML-mode reparse (e.g. loading the block into the editor) then
  //   invents a *second* `<br>` from the dangling `</br>`, per the HTML5 rule
  //   that a stray `<br>` end tag opens a new `<br>` rather than closing one.
  // - `recognizeSelfClosing: true` restores what HTML mode otherwise gives up:
  //   without it, a self-closing custom tag like `<mj-image src="…" />` never
  //   actually closes, and swallows whatever follows as its child instead of
  //   its sibling — verified against a self-closing `<mj-all />` immediately
  //   followed by a sibling `<mj-text />` inside `<mj-attributes>`, which
  //   nested the second tag inside the first and silently dropped a per-tag
  //   attribute default.
  const $ = load(mjml, { xml: { xmlMode: false, recognizeSelfClosing: true } });
  const cascade = buildAttributeCascade($);

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];

  const settings = extractSettings($, cascade, warnings);

  const $body = findByTag($, "mj-body").first();
  const ctx: ConvertContext = {
    $,
    cascade,
    containerWidth: settings.width,
    warnings,
  };

  const blocks = $body.length > 0 ? walkBody($body, ctx, entries) : [];

  if (blocks.length === 0) {
    warnings.push(EMPTY_DOCUMENT_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings,
  };

  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  const report: ImportReport = { entries, warnings, summary };

  return { content, report };
}
