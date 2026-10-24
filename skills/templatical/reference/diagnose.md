# Diagnosing an existing integration

**Read first:** [failure-modes.md](failure-modes.md) — the table read backwards
is the method
**Related:** [integrate.md](integrate.md) for what a correct mount looks like ·
[docs.md](docs.md) for the underlying reference ·
[version-awareness.md](version-awareness.md) for version-sensitive symptoms

Read their `init()` call, their bundler config and their CSS setup, and match
what you find against the table before changing anything. Several of these
symptoms are indistinguishable from a broken build until you know the
signature — a sidebar whose last items and footer are cut off with no scroll
is the height-chain row in [failure-modes.md](failure-modes.md), and nothing
throws or logs to make it obvious.

No Issues tab means `@templatical/quality` is missing or was left out. Add it
to the app's dependencies to restore the Issues panel and lint badges. If it
is present, check `lint.disabled` and per-tool settings.

For AI assistant file attachments or screenshot/PDF import, consult [providers.md](providers.md) and fetch `backend/ai`, `api/ai-kit` and `guide/bring-your-own-ai` through [docs.md](docs.md). Check `chat` is a function, `chatAttachments` is true and a template is loaded. Text-only backends set `features: { chatAttachments: false }`; use `runAiWireConformance` to check multipart generate and upload limits. The author sends after the import picker; no automatic turn starts.

No AI assistant means `ai` is absent, `chat` is false, or `editor.load(id)` / `editor.create()` has not resolved. Check the loaded-template gate before changing the backend. No Fix with AI or Write alt text means `@templatical/quality` is missing or lint is off; also check their provider members and matching findings. Fetch `/backend/ai` through [docs.md](docs.md), then its required setup and contract links.
