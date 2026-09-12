# Diagnosing an existing integration

**Read first:** [failure-modes.md](failure-modes.md) — the table read backwards
is the method
**Related:** [integrate.md](integrate.md) for what a correct mount looks like ·
[docs.md](docs.md) for the underlying reference ·
[version-awareness.md](version-awareness.md) for version-sensitive symptoms

Read their `init()` call, their bundler config and their CSS setup, and match
what you find against the table before changing anything. Several of these
symptoms are indistinguishable from a broken build until you know the
signature — an editor that renders but ignores every click is the
duplicate-reactivity row in [failure-modes.md](failure-modes.md), and nothing
throws or logs to make it obvious.
