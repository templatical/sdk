# Evals — integration and Q&A quality checks

These prompts exercise the skill's other half — the one `tests/` can't
reach. That suite proves the generated `reference/` tree is internally
consistent (every file's hash matches `manifest.json`, every router entry
resolves, the cited SDK version agrees, the manifest stays consumer-safe); it
says nothing about whether the skill gives correct, complete advice for a
real integration or troubleshooting prompt. This is a maintainer artifact,
not part of the runtime skill.

`evals.json` follows the [`skill-creator`](https://code.claude.com/docs/en/skills)
eval format — the same shape `templatical-email`'s eval set uses — so the
easiest way to run them is through the `skill-creator` skill: it runs each
prompt with the skill vs. a baseline, opens a review viewer, and helps you
iterate on `SKILL.md` / `reference/`.

Manual loop (without skill-creator):

1. In an agent that has this skill installed, run each `prompt` from
   `evals.json`.
2. Judge the response against the `expected_output` bar. Read it as two
   halves: what a correct answer contains, and — where it's called out —
   what it must **not** claim. Several cases here are scored as much on the
   second half as the first; an answer that includes everything expected but
   also asserts one forbidden claim on top still fails.
3. Where it falls short, improve `SKILL.md` or the relevant `reference/`
   page and re-run. Prefer fixing guidance over adding rigid rules.

## Why the "must not claim" half matters here

A wrong answer to an integration question rarely reads as wrong — it reads
as a plausible, confident, slightly-off answer that only breaks once someone
tries it. Three cases are built around exactly that shape, a specific wrong
claim that sounds reasonable on its own:

- **"How do I get sendable HTML?" (id 8)** — the almost-right answer is
  "call `editor.toHtml()`", full stop. The honest answer names the `render`
  provider requirement: `toHtml()` has no local path at all, with or without
  `@templatical/renderer` installed. See `reference/backend/render.md`.
- **"Is there a React component?" (id 9)** — the almost-right answer hedges,
  or invents one. The correct answer is a flat no, with the reason (Vue is
  bundled and hidden precisely so the editor stays stack-agnostic), pointing
  at the imperative `init()` wrapper as the real integration, not a
  workaround for a missing component.
- **"Add a countdown block" (id 10)** — the almost-right answer treats
  countdown as an ordinary block behind an ordinary config flag
  (`paletteBlocks`, a boolean). It isn't: the palette only offers it under an
  active Cloud plan, and the open-source renderer can't produce a working
  countdown even if one ends up in the content some other way.

The email skill's own eval #3 was wrong for a long time for the mirror-image
reason — it only listed what a correct countdown-invite template should
*include*, so nothing caught a generation that added a real `countdown`
block on top of an otherwise-correct answer. Every `expected_output` here
that has a genuine wrong-but-plausible answer states the forbidden claim
alongside the required content, not instead of it.

## What these evals don't check

Correctness of the reference tree itself — freshness, router completeness,
version agreement, the consumer-safe manifest — is already enforced by this
skill's own `tests/`. These evals are about whether the skill's *advice* is
right when read by someone actually building against it: does it propose
before scaffolding an unfamiliar app, does it name the actual trap instead of
a generic one, does it stop short of a claim the SDK doesn't back up.
