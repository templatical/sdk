# Requirements

**Phase island.** Read once per session, before the first command. Every other
playbook assumes it and none repeat it.
**Related:** [working-files.md](working-files.md) — where templates live.

**Every command below runs through one pinned CLI, and the invocation always
starts the same way:**
```
npx -y @templatical/template-tools@0.38.0 validate <file> --json
```
`npx`, then `-y`, then the package name pinned to an exact version, is the
fixed prefix — identical for `validate`, `render`, `edit`, `import`, `live`, and
`list`; only the subcommand and its own flags change after it. Copy that
prefix exactly: no reordering, no requoting, and never `@latest` in its
place — pinning is what keeps this skill's `reference/schema.json` from ever
disagreeing with the CLI's own block model, since a release moves both
together. `-y` is required: without it, npx's first-fetch confirmation
prompt stalls the turn with no visible cause.

**Node 20+ and network access — for everything, not just live mode.** `npx`
fetches the pinned CLI package from npm the first time it's run at that
version, then npm caches it; after that, no network round trip is needed
until the pin changes at a future release. **Nothing is installed into the
user's project** — no `package.json` edit, no lockfile change, no
`node_modules` entry. `npx` runs the package straight from npm's cache. That's
the property to reassure a wary user about first.

Two commands may each ask for **one** additional install, and the CLI prints
the exact command when it does:

- `render --format html` needs the `mjml` package.
- `import` needs the converter for the source format.

**The exit code says which situation you're in — read it, don't guess from
the output:**

| Exit | Meaning |
|---|---|
| `0` | Succeeded. `validate` may still report lint warnings. |
| `1` | The template itself is invalid — fix the JSON, not the tool. |
| `2` | The command was misused, or the tool broke — bad flags, an unreadable file, an unexpected internal error. |
| `3` | One of the two optional packages above is missing. Install it, then re-run — not a bug. |

When a prerequisite is absent, say so plainly with the fix and fall back to a
mode that works — no Node, too old a version (`node -v`, then
<https://nodejs.org>), or no network blocks everything; no background process
or reachable port (a hosted, server-side sandbox) blocks only [live
mode](live.md), and build mode is unaffected.
