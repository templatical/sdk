# Working files

**Consulted by:** [build.md](build.md) · [live.md](live.md)
**Related:** [cli.md](cli.md) · [resume.md](resume.md) when the active filename
has been lost

Every template lives in the user's `.templatical/` folder as its own file with a
random three-word name, like a Claude plan file — e.g.
`.templatical/misty-copper-otter.json`. This keeps finished work around as a
browsable history instead of one file that silently carries state between
unrelated sessions.

- **New by default.** When the user asks for a template, treat it as a **new**
  one: generate a fresh three-word kebab-case name (playful is fine), confirm no
  file of that name already exists in `.templatical/` (regenerate if it does —
  never overwrite an existing template), and write there. A fresh session thus
  starts a fresh template; never silently resume an earlier one.
- **Resume only on request.** If the user asks to continue a previous template
  ("keep working on the welcome email", "open misty-copper-otter"), list what's
  there:
  ```
  npx -y @templatical/template-tools@0.36.0 list --json
  ```
  Each entry carries a title hint pulled from the template's first heading
  block — use it to figure out which one the user means.
- **One template per session.** Track the active file name for the whole
  session so build mode and live mode operate on the same template — validate,
  render, edit, and reload all target that file. The `.templatical/`
  folder is a working area; it's fine to leave old templates there (suggest
  the user gitignore it), and the user can clear it whenever they like.
