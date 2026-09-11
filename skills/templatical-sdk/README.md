# @templatical/sdk-skill

An [Agent Skill](https://templatical.com) that gives any coding agent that
reads `SKILL.md` **integration guidance** for
[`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor): how
to install, mount, configure, theme and troubleshoot the SDK in your own app,
and how to answer "how do I" / "is it possible" questions about it. It is the
router-plus-reference-tree counterpart to
[`templatical-email`](../templatical-email) — that skill authors and validates
template JSON; this one wires `@templatical/editor` into a codebase. "Build a
welcome email and wire it into my app" wants both, in that order: author and
validate the template first, then integrate. See "Two skills, not one" below
for why they ship as two separate skills rather than one.

## What's here

```
templatical-sdk/
  SKILL.md                          # the router: install/mount, failure modes,
                                     # providers, version awareness, scaffolding,
                                     # plus a generated index between two markers
  reference/
    manifest.json                   # sha256 per file + the SDK version it was made from
    index.md, license-faq.md, showcase.md
    getting-started/, guide/, api/, backend/, cloud/, quality/
                                     # every English docs page, copied verbatim
  tools/
    generate-reference.mjs          # regenerates reference/ + SKILL.md's index
  tests/
    reference-freshness.test.ts     # every file's hash matches manifest.json
    router-completeness.test.ts     # every reference/ page is indexed, and vice versa
    version-agreement.test.ts       # SKILL.md's cited version equals the manifest's
    consumer-safe-manifest.test.ts  # no workspace:* deps, so `npm install` works standalone
  evals/
    evals.json, README.md
  package.json
  vitest.config.ts
```

No `scripts/`, no `vendor/` — the one script this skill carries is
`tools/generate-reference.mjs`, which is maintainer-only tooling. Nothing here
is a network dependency of the skill at answer time — `reference/` is a local,
committed copy.

## Two skills, not one

`templatical-email` and `templatical-sdk` cover different jobs for different
audiences — authoring a template vs. integrating the editor — so they stay two
skills rather than one that tries to do both. A skill is selected by matching
intent against its description, and one description covering both jobs
matches everything and discriminates nothing.

`npx skills add templatical/sdk` installs **both** in one command, and each
skill's `SKILL.md` names the other and says when to hand over: authoring or
editing a template is `templatical-email`; wiring `@templatical/editor` into a
codebase is `templatical-sdk`. "Build a welcome email and wire it into my app"
wants both, in that order.

## The reference tree

`reference/` is a **generated, verbatim copy** of the English pages at
[docs.templatical.com](https://docs.templatical.com) — same content, same
frontmatter, byte-identical to their source. It exists so the skill can
answer integration questions from a local, hash-manifested copy instead of
fetching pages over the network for every question.

Regenerate it with:

```bash
pnpm --filter @templatical/sdk-skill run generate-reference
```

This copies every page `apps/docs/scripts/build-agent-surface.mjs` collects
for the docs site's own `llms.txt` — imported, not reimplemented, so this
skill's router and `docs.templatical.com/llms.txt` can never disagree about
what a page is for, or what order its groups read in. It also writes
`reference/manifest.json` (a sha256 per file, the SDK version the copy was
made from, and the page count), rewrites `SKILL.md`'s generated index between
its `<!-- BEGIN GENERATED INDEX -->` / `<!-- END GENERATED INDEX -->`
markers, and deletes any `reference/` page that no longer has a source docs
page — so a renamed or removed docs page doesn't leave a permanent orphan
with a stale-but-self-consistent hash.

**Freshness is checked as internal consistency, not as a comparison against
`apps/docs` at HEAD.** `tests/reference-freshness.test.ts` hashes every
committed file under `reference/` and asserts it matches
`manifest.json` — nothing in this skill's test suite re-reads the live docs
source and diffs against it. That's deliberate: the docs change on nearly
every feature PR in this monorepo, so a HEAD comparison would fail this
skill's own CI on every docs typo, and would force this tree to be
regenerated for a change that has nothing to do with the skill itself. Regeneration instead
runs **once per release**, wired into the root `changeset:version` script
after `changeset version` has already bumped `@templatical/editor`'s
version — the number `manifest.json` and `SKILL.md`'s generated index both
cite. Between releases, `reference/` is frozen: correct as of the release it
documents, not as of whatever the docs site currently says.

`tests/router-completeness.test.ts` covers the other half: every page under
`reference/` is listed in `SKILL.md`'s generated index, and every index
entry resolves to a file that actually exists — so the router can never
point an agent at a page that isn't there.

## Requirements

The same floor as `templatical-email` for the parts they share — a coding
agent that supports Agent Skills, running on your own machine, allowed to run
commands and write files. This skill's own knowledge (`reference/`) needs
**no network access to read** — it's a local copy, bundled with the skill.

Network access is needed only for the two things this skill does on your
behalf via the same published
[`@templatical/template-tools`](https://www.npmjs.com/package/@templatical/template-tools)
CLI `templatical-email` uses: an exact block-schema lookup
(`npx -y @templatical/template-tools@<version> schema`, rather than carrying
a second copy of the schema that could drift), and — when your installed
`@templatical/editor` is older than the reference describes — reading pinned
source straight from GitHub at your version's tag, instead of silently
answering from a newer release.

Scaffolding and verification also run your project's own dev server (see
`SKILL.md`), so whatever your app already needs to run applies here too —
this skill adds no runtime requirement on top of that.

Not needed: a Templatical account, an API key, or a backend.

## Install

```
npx skills add templatical/sdk
```

Installs **both** `templatical-email` and `templatical-sdk` in one command, via
the [`skills` CLI](https://github.com/vercel-labs/skills) (unrelated to
`@templatical/template-tools`), which detects which supported agents you have
and installs each skill into the directory that agent reads. Re-run it to
update.

It reports anonymous usage telemetry by default (repository and skill
identifiers, for repositories GitHub confirms are public); set
`DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` first if you'd rather it didn't.

Your agent picks the skill up on its own the next time you ask an integration
question, or ask it to scaffold or diagnose an `@templatical/editor` mount.

## Never touches git

Like `templatical-email`, this skill proposes file changes and waits for a
go-ahead before writing them, then verifies by running your dev server — it
never runs a commit, a branch, or a stash. Reviewing and committing the
result is yours to do.

## License

MIT.
