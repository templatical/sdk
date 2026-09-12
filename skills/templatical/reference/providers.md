# Providers

**Consulted by:** [integrate.md](integrate.md)
**Detail:** [docs.md](docs.md) reaches one reference page per provider — fetch
the one matching the key being configured

Six optional config keys, each a plain object of methods: `templates`,
`versionHistory`, `comments`, `savedBlocks`, `testEmail`, `render`. Every key
stands alone — a feature is absent until its key is passed, not merely
disabled: no half-rendered panel, no dead button.

**On the four storage providers (`templates`, `versionHistory`, `comments`,
`savedBlocks`) every mutation is `false | fn`, and it's required, never
optional.** Passing `false` is a typed statement that the action is
unavailable — calling it rejects, and the editor hides the control for it
rather than rendering one that does nothing. Leaving a mutation off the
object is not the same decision as writing `false`, and a provider has to
make the choice explicit. `render` and `testEmail` are shaped differently:
every `render` method (`toMjml`, `toHtml`, `compileMjml`) is independently
optional, and `testEmail` is a single `send`.

Full contracts, headless use (`useSavedBlocks`, `useVersionHistory`,
`useComments` from `@templatical/core`, for driving a custom UI with no
editor mounted), and Cloud as one implementation of each: [docs.md](docs.md) → the `backend/` pages.
