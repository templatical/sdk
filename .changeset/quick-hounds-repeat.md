---
"@templatical/editor": patch
---

Send test emails through the configured render provider

`testEmail.includeMjml` rendered with the bundled `@templatical/renderer`
even when `render.toMjml` was configured, so a consumer with an authoritative
backend renderer received a test built from a different pipeline than the real
send — the one thing a test email exists to rule out. Anything the backend adds
that the browser cannot (a platform footer, a server-composited block) was
absent from the test and present in the delivered message.

`editor.toMjml()` was always correct; only the test-email payload took the
local path. The entry point now hands the editor the same resolution ladder
both use, so a test carries byte-identical MJML to an export.

The `includeMjml` degradation ladder gains two rows for the provider path. A
missing `@templatical/renderer` explains a failed render only when the bundled
renderer is what ran, so a consumer whose backend renders — and who therefore
has no reason to install the package at all — no longer has their backend's own
error read as an absent dependency, swallowed into a JSON-only send and answered
with advice to install something that would change nothing. A throwing render
provider now fails the send, exactly as a broken template already did.

Unaffected: consumers with no `render` provider, those supplying only
`compileMjml`, and Cloud, whose `testEmail` key excludes `includeMjml` at the
type level.
