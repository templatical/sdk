# Evals — generation-quality checks

These prompts exercise the skill end-to-end to check **generation quality** — do
the templates actually look good and fit the brief? — which the unit tests don't
cover (those only prove the output is _structurally valid_). This is a maintainer
artifact, not part of the runtime skill.

`evals.json` follows the [`skill-creator`](https://code.claude.com/docs/en/skills)
eval format, so the easiest way to run them is through the `skill-creator` skill:
it runs each prompt with the skill vs. a baseline, opens a review viewer, and
helps you iterate on `SKILL.md` / `reference/`.

Manual loop (without skill-creator):

1. In an agent that has this skill installed, run each `prompt` from `evals.json`.
2. Load the generated JSON into the editor (or render it) and judge it against
   the `expected_output` bar: right blocks, sensible layout, brand applied, AA
   contrast, alt text on images, one clear CTA.
3. Where it falls short, improve the guidance — usually `reference/block-guide.md`
   or a new/adjusted example in `reference/examples/` — and re-run. Prefer fixing
   guidance over adding rigid rules.

Correctness (valid JSON, schema-in-sync-with-types) is already enforced by
`tests/` + the schema-freshness guard; these evals are purely about taste and
completeness.
