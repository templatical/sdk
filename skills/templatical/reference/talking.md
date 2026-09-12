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
