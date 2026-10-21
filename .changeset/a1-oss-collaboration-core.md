---
"@templatical/core": minor
---

Real-time collaboration over a provider

- `useCollaboration({ provider, loadTemplate })` runs a collaboration session over any `CollaborationProvider`: it captures the editor's changes as operation batches (`diffContent`), sends one batch at a time with retries under the same `batchId`, applies other sessions' batches strictly in revision order with its own pending ones replayed on top, catches up through `operationsAfter`, takes the selected block's lock, tracks presence, and keeps undo and redo as guarded inverse batches (`invertOperations`) that a backend can refuse.
- `diffContent(before, after)` and `invertOperations(before, ops)` are exported for headless use.
- `useCollaboration({ normalizeRemoteOperations })` rewrites another session's batch, live or from a catch-up, just before it is applied, given the content it applies to. The editor uses it to turn merge-tag tokens into tags. `onRemoteChange` receives the batch as the backend sent it.
- Other sessions' batches apply without their `expect` preconditions: the backend already checked them against its own copy, which can differ from this one in merge-tag markup alone. Any other refusal re-syncs.
- `useCollaboration({ onRemoteResync })` says who caused a re-sync, when the backend passes `onResync` an actor, before the editor catches up.

Breaking changes:

- `useHistory` no longer takes `isRemoteOperation`.
- Cloud (experimental, outside semver until Cloud GA): `@templatical/core/cloud`'s peer-to-peer collaboration and MCP listener are removed: `useCollaboration`, `useCollaborationBroadcast`, `UseCollaborationOptions`, `UseCollaborationReturn`, `useMcpListener`, `UseMcpListenerOptions` and `handleOperation`. `useCollaboration` now lives in `@templatical/core` and runs over a `CollaborationProvider`.
