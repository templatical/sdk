import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { SYNTAX_PRESETS } from "@templatical/types";
import type { Block } from "@templatical/types";
import { tagOf } from "./attribute-resolver";

type DisplayCondition = NonNullable<Block["displayCondition"]>;

export interface SiblingUnit {
  $el: Cheerio<Element>;
  displayCondition?: DisplayCondition;
}

/** Characters kept before an ellipsis is appended; the full condition stays in `before`. */
const LABEL_MAX = 46;

const ANCHORED_LOGIC = Object.values(SYNTAX_PRESETS).map(
  (preset) =>
    new RegExp(
      `^(?:${preset.logic.source})$`,
      preset.logic.flags.replace("g", ""),
    ),
);

/**
 * Whether the text is exactly one logic tag and nothing else.
 *
 * Anchored against every registered syntax rather than one, so a mailchimp or
 * ampscript template is recognised as readily as a liquid one. MSO conditionals
 * are HTML comments and match none of them, which is what keeps hand-written
 * `mj-raw` pairs out of this path.
 */
export function isLogicTagOnly(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return false;
  return ANCHORED_LOGIC.some((regex) => regex.test(trimmed));
}

function isLogicRaw($el: Cheerio<Element>): boolean {
  return tagOf($el[0]) === "mj-raw" && isLogicTagOnly($el.text() ?? "");
}

function synthesizeLabel(before: string): string {
  const trimmed = before.trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX)}…`;
}

/**
 * Group a run of siblings into units, folding each `logic-raw / element /
 * logic-raw` triple into one unit carrying a `displayCondition`.
 *
 * `label` is synthesised from `before`: it is editor metadata that appears
 * nowhere in the MJML, so it cannot be recovered — only reconstructed. `group`
 * and `description` are left absent for the same reason.
 *
 * Deliberately no check that the two tags pair *semantically*. The renderer
 * emits them only in this arrangement, and matching open/close keywords across
 * four syntaxes would be a table to maintain for no gain.
 */
export function planSiblings($siblings: Cheerio<Element>[]): SiblingUnit[] {
  const units: SiblingUnit[] = [];
  let i = 0;

  while (i < $siblings.length) {
    const $current = $siblings[i];

    const $middle = $siblings[i + 1];
    const $closing = $siblings[i + 2];

    const isTriple =
      isLogicRaw($current) &&
      $middle !== undefined &&
      tagOf($middle[0]) !== "mj-raw" &&
      $closing !== undefined &&
      isLogicRaw($closing);

    if (isTriple) {
      const before = ($current.text() ?? "").trim();
      const after = ($closing.text() ?? "").trim();
      units.push({
        $el: $middle,
        displayCondition: { label: synthesizeLabel(before), before, after },
      });
      i += 3;
      continue;
    }

    units.push({ $el: $current });
    i += 1;
  }

  return units;
}
