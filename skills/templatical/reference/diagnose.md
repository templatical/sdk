# Diagnosing an existing integration

**Read first:** [failure-modes.md](failure-modes.md) — the table read backwards
is the method
**Related:** [integrate.md](integrate.md) for what a correct mount looks like ·
[docs.md](docs.md) for the underlying reference

Read their `init()` call, their bundler config and their CSS setup, and match
what you find against the table before changing anything. Several of these
symptoms are indistinguishable from a broken build until you know the
signature — an editor that renders but ignores every click is the clearest
example, and is otherwise near-undebuggable.

The same table, read backwards. Read the consumer's `init()`/`initCloud()`
call, bundler config and CSS setup, and check each against the failure modes
above. "The editor renders but ignores every click" is the
duplicate-reactivity signature specifically — otherwise close to
undiagnosable, since nothing throws and nothing logs.
