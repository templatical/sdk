# Evals — generation and integration quality checks

Fifteen prompts that exercise the skill end-to-end across both of its jobs —
authoring a template (cases 1–5) and integrating or troubleshooting the SDK
(cases 6–15). They check **quality**: does a generated template look good and
fit the brief, and is integration advice correct and complete?

A maintainer artifact, not part of the runtime skill. Nothing here ships to a
user who installs the skill.

## Running them

`evals.json` is plain JSON — `skill_name` plus an `evals` array of
`{ id, prompt, expected_output, files }`. It is deliberately not tied to one
vendor's eval runner, because the skill itself is not: it is written for any
coding agent that reads `SKILL.md`, and its harness should not assume more than
that.

So the primary loop is manual, and works in any agent:

1. In an agent that has this skill installed, run a case's `prompt` verbatim.
2. Judge the result against that case's `expected_output`. For template cases,
   load the JSON into the editor or render it, and check the bar it names:
   right blocks, sensible layout, brand applied, AA contrast, alt text on
   images, one clear CTA. For integration cases, check the advice is correct
   for the stack described and complete enough to act on.
3. Where it falls short, improve the guidance — usually
   `reference/block-guide.md`, the relevant island, or a new example under
   `reference/examples/` — and re-run. Prefer fixing guidance over adding
   rigid rules.

If your agent has its own eval runner that can drive a prompt list, use it.
The file's shape matches the `skill-creator` eval format, so that tool can read
it directly; treat that as one convenience among others rather than the
supported path.

## Why they are not in CI

Each run needs an LLM, so it **costs money per run** and is
**non-deterministic** — the same prompt gives a different template each time,
and judging it is a taste call rather than an assertion. A CI job would be
flaky and expensive, and a flaky gate gets ignored, which is worse than no gate.

## When to run them

**These are the only behavioural check on routing.** `SKILL.md` is a router:
it discriminates once, then loads exactly one playbook. `tests/island-graph.test.ts`
proves the graph is walkable — every Commands-table row resolves to a file, every
link between islands resolves, no island is orphaned — but it cannot prove the
router *picks the right one*. Nothing else can, either. A request that should
reach `scaffold` and lands in `docs` produces a plausible, useless answer, and
every unit test still passes.

So run these when the Commands table changes, when an entry island's scope
moves, or when the discrimination prose is reworded. Cases 6–15 cover the SDK
side, where most routing ambiguity lives.

## What they do not cover

Correctness. Whether a template is *valid* is settled mechanically and needs no
LLM: this skill's own `tests/` plus `packages/template-tools`'s schema-freshness,
schema-parity and `validate` suites. A template that passes those can still be
ugly, off-brief, or inaccessible — that gap is what these evals measure.
