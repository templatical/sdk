# Entering live mode

**Before:** [cli.md](cli.md), and a template that already exists — build or
import one first
**Then:** [live.md](live.md), the loop this hands off to

Live mode is the only thing in this skill that needs a browser and a reachable
port. A hosted sandbox blocks it; every other mode still works there.

Enter it whenever the user expresses the intent — "show it live", "preview it
live", "open it in the editor", "build this in live mode", or similar — mid-session
is fine. Natural-language intent is the portable trigger and works on every
harness. (In Claude Code you can also pass it as an argument with a **space**:
`/templatical live` — use a space, not a colon; `/templatical:live` is
plugin-command-namespace syntax that silently starts build mode instead.)
Live mode serves the session's working template (`.templatical/<name>.json`, see
[Working files](working-files.md)); if the user hasn't built one yet, create a new
template first. A mid-session switch just points the bridge at that file.

> **Working directory matters — every command that touches the working file
> resolves relative to it, here and in [live.md](live.md)'s `edit`,
> `validate`, `live reload` and `live stop`.** `npx` fetches the pinned CLI
> package from npm's cache no matter where you run it, but everything the
> CLI *touches* — the working file, the live server's pidfile, any
> cwd-installed optional converter — resolves against the current directory.
> Run every command below with the **user's project** as the current
> directory, not this skill's folder. If you can't control the cwd, pass
> `--cwd <project>` (and, for `live`, optionally `--file <path>`) so
> `start`/`reload`/`stop` all agree on the same location.

1. Ensure the session's `.templatical/<name>.json` exists and is valid (run
   `validate`; build a new template first if there isn't one yet — see
   [Workflow](build.md)).
2. Start the bridge in the background (from the project root), pointing it at
   the session's template with `--file`:
   ```
   npx -y @templatical/template-tools@0.38.0 live --file .templatical/<name>.json --json
   ```
   Read the URL and working-file path from the JSON line on stdout (`url`,
   `workingFile`) rather than pattern-matching prose — the bridge also opens
   the URL in the user's default browser itself. It prefers port 4747 but
   falls back to a free OS-assigned port if that's taken (`fellBack: true`
   when it did — don't assume the fixed port). It's single-instance via a
   pidfile guard; a second start just reports the one already running. Other
   flags: `--port <n>`, `--cwd <project>`, `--no-open` (skip the auto-open).
3. Share the URL in your reply so the user has it (to reopen, or open on
   another device). The bridge **already opened it in their default
   browser** on start, so you don't need to open it yourself — and never with
   a browser-automation/testing tool (e.g. Playwright). If the auto-open
   didn't fire (a headless or sandboxed environment), just point the user to
   the URL. The page shows the current template in the real editor.
