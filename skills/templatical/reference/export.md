# Rendering to MJML or HTML

**Before:** [validate.md](validate.md) — rendering an invalid template surfaces
renderer internals instead of the error list
**Alternative:** [live.md](live.md)'s Export modal offers JSON, MJML and HTML in
the browser, which is the only route for someone with no npm

Most hand-offs are the JSON itself (see [Workflow](build.md) step 5). When
the user needs the email in a sendable format instead — to paste into an ESP,
or because they have no editor integration to load JSON into — render it:

```
npx -y @templatical/template-tools@0.36.0 render .templatical/<name>.json --format mjml -o .templatical/<name>.mjml
npx -y @templatical/template-tools@0.36.0 render .templatical/<name>.json --format html -o .templatical/<name>.html
```

Drop `-o <file>` to print the rendered output to stdout instead, if you'd
rather hand it to the user inline than read it back from disk.

- **`--format mjml` always works** on a bare `npx` call — the renderer is a
  hard dependency of the CLI, nothing extra to install.
- **`--format html` needs the optional `mjml` compiler.** If it's missing the
  command exits `3` and prints the install command (see
  [Requirements](cli.md)) — that's the one extra install to offer, not
  a failure to work around.
- **[Live mode](live.md)'s Export button** offers JSON / MJML / HTML from
  the browser, compiled client-side — reachable for anyone with a browser and
  no npm at all.

**Be plain about the one real gap this leaves.** On a hosted, sandboxed agent
with network access but no ability to run an install and no reachable
browser, you can produce MJML but not HTML — and almost no ESP accepts MJML
directly. Say so rather than imply HTML is always one command away: offer
live mode's Export when it's reachable, and otherwise name the exact `npm
install mjml` the environment would need.
