# Talking to the user

**Consulted by:** every playbook. How to report what you did, and what not to
claim.

Communicate about the _email_, not the machinery. The mechanical steps — reading
the references, picking an example, validating, generating file names, managing
`.templatical/` — are for you, not the user; do them silently.

- **Lead with intent and result.** A sentence of what you're building is plenty
  ("Building an event invitation with clean neutral defaults"), then hand over
  the template. Skip the play-by-play of your own file reads and checks.
- **Surface real choices, not internals.** Worth saying: "there's a template
  from a previous session — start fresh or continue it?" Not worth saying: the
  exact CLI invocation, flags, file paths, example filenames, or "reading the
  schema / validating" — keep those out of user-facing messages.
- **npx's own noise isn't yours to narrate.** On a cold cache it prints its own
  progress fetching the pinned CLI version — that's normal, not part of this
  skill's output, and not an error. Don't call it out and don't apologize for
  it; only speak up when a command's exit code says something actually went
  wrong.
- **Mention setup only on action or failure** — say something when a
  prerequisite is genuinely missing (see [Requirements](cli.md)) or a
  step actually fails, not to confirm that routine state is fine.
- **Report real problems plainly** when they happen (a validation error you
  couldn't resolve, a missing dependency) with the fix — that's signal, not noise.

## Offering an update, once, at the end

An installed skill never refreshes itself, so a user can sit on an old copy
indefinitely without knowing. Check once per session, **after** the work is
done, and mention it only when there is genuinely something newer.

Read the skills CLI's own record of what it installed —
`~/.agents/.skill-lock.json`, or `$XDG_STATE_HOME/skills/.skill-lock.json`
when that variable is set. Find the entry whose `source` is `templatical/sdk`
and take its `updatedAt`. Then ask GitHub whether this skill's folder has
changed since:

```
https://api.github.com/repos/templatical/sdk/commits?path=skills/templatical&since=<updatedAt>&per_page=1
```

A non-empty array means a newer skill exists. Say exactly this, once:

> A newer Templatical skill is available. Update? It runs
> `npx skills update templatical`.

Use `updatedAt`, not `installedAt` — it moves when the user runs
`skills update`, so it is the real "last time I received content". Do not try
to compare `skillFolderHash`: the skills CLI computes it, and reproducing that
algorithm here would break the moment it changes.

**Every failure here is silent.** Skip the check and say nothing if the lock
file is absent, has no entry for this skill (a folder copy, or a checkout of
the repo itself), the entry's `sourceType` is not `github`, the request fails,
returns anything but 200, or you have no way to make it — the API is
unauthenticated and rate-limited, and offline is normal. Use `curl -s` if you
have no fetch tool. **This check must never delay, interrupt or replace the
work the user actually asked for**, and a user who declines may hear it again
next session — that is the accepted cost of keeping no state of our own.
