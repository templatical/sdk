# Live mode

**Before:** [live-setup.md](live-setup.md) — the server must already be running
**Uses:** [edit.md](edit.md) for scoped changes · [validate.md](validate.md)
before every write · [annotations.md](annotations.md) for notes the user leaves
in the browser instead of in chat
**Related:** [working-files.md](working-files.md) for which file is being served

Live mode opens the template in the **real** Templatical editor in a browser and
keeps it in sync as the user prompts, so they watch the email take shape and can
also drag-edit it directly. It's optional.

**Where it runs.** Live mode runs on the user's own machine — it keeps a
background process (the bridge) alive across turns, reaches `localhost`, and
needs the user's browser (Chrome/Edge 80+, Firefox 101+, Safari 16.4+ — the
floor the CDN-loaded editor needs). If your environment can't do that (e.g. a
hosted or server-side sandbox with no local filesystem or reachable port),
tell the user live mode isn't available here and stay in build mode. Build
mode itself is unaffected.

**It adds nothing beyond the CLI itself.** The bridge — the CLI's `live`
command — uses only Node built-ins; the editor and `mjml-browser` load from
the CDN in the browser. None of that is fetched or run until live mode
actually starts.

## The prompt → live-update loop

When the user asks for a change:

1. **Check for divergence and notes first.** Read the editor's latest state
   from the bridge's `GET /content` endpoint (at the URL from step 2 above,
   e.g. `http://localhost:4747/content`) → `{ divergent, content, annotations }`.
   - `divergent: false` → no in-browser hand-edits since your last write. Proceed.
   - `divergent: true` → the user hand-edited in the browser. **Ask before
     overwriting:** _"You've edited the template in the browser since I last
     updated it. Build on your browser version, or replace it with what I have?"_
     - **Browser version** → take the returned `content` as your new base and
       continue.
     - **Replace with mine** → apply to your own version; say explicitly that
       this discards their browser edits.
2. **Apply the change.** For a scoped edit, prefer an operation (see [Editing
   with operations](#editing-with-operations)) — `edit` validates and writes
   in one step, composing on top of whatever's currently in the working file
   rather than discarding it:
   ```
   npx -y @templatical/template-tools@0.36.0 edit .templatical/<name>.json --op '<json>' --json
   ```
   For a genuine rebuild, regenerate the document and **validate it before
   writing** — never push invalid content to the editor:
   ```
   npx -y @templatical/template-tools@0.36.0 validate .templatical/<name>.json --json
   ```
   then write it to `.templatical/<name>.json` yourself.
3. **Push the write** to the browser:
   ```
   npx -y @templatical/template-tools@0.36.0 live reload --json
   ```
   The page updates live (over Server-Sent Events) — no refresh. This also
   clears `annotations`, so a note is never acted on twice.

## Export

The page's **Export** button opens a modal with **JSON / MJML / HTML** tabs
(HTML compiles in-browser via `mjml-browser`, loaded on demand) — reachable
for anyone with a browser and no `npm`. You can also render either format
yourself without live mode; see [Rendering to MJML or
HTML](#rendering-to-mjml-or-html).

## Ending live mode

Stop the bridge when the user is done (or the session ends) so no process or port
is orphaned:

```
npx -y @templatical/template-tools@0.36.0 live stop --json
```

## Notes & limits

- **`.templatical/` is a working directory** — it holds the shared template and
  the bridge's pidfile. Suggest the user add `.templatical/` to their project's
  `.gitignore` (don't edit their `.gitignore` without asking).
- **Local and single-user.** This is an ephemeral local bridge, not the Cloud
  realtime/collaboration path (no accounts, no persistence, no multi-user).
- **`html` blocks run as-is** in the preview (the editor sanitizes rich text, but
  raw `html` blocks are not sanitized). It's the user's own local content, but be
  aware the preview executes it.
- The CDN editor the live harness loads is pinned to a version whose block
  model matches `reference/schema.json` — kept in sync automatically at
  release time, so the live editor and this skill's schema never drift apart.
