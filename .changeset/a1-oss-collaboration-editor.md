---
"@templatical/editor": minor
---

Real-time collaboration in the editor over your backend, and agents' edits named

- `init({ collaboration })` collaborates over any `CollaborationProvider` (it needs `templates`, whose `load` returns the template's `revision`). Every edit is sent as operations; other people's edits appear on the canvas in order; selecting a block locks it, and others' locked blocks show their holder's name and colour and can't be selected; the header shows who else is here, one avatar per person; undo and redo cover your own edits and skip, with a notice, a step someone else has overtaken. `init({ onRemoteChange })` reports another session's edits.
- With a collaboration provider, `templates.save` receives only renames, after the editor's batches are confirmed; a version preview pauses collaboration, and a restore re-syncs from the backend and names the people whose locks refuse it.
- The merge-tag tokens in another session's batch — an AI agent's, another editor's, a server's — become tags as the batch arrives, the way loaded content's do, and nothing is sent back for it.
- A batch from an agent (`actor.type: "mcp"`) shows a notice — "Claude for Ada changed 3 blocks", or the template settings — and outlines the changed blocks for 2 seconds, held still under reduced motion. An agent's re-sync reads "Claude for Ada updated the template". Batches and re-syncs from one agent within 2 seconds share a notice.
- The bar, lock outlines and notices are translated into all eight locales.
- The collaboration contract's types (`CollaborationProvider`, `CollaborationHandlers`, `Operation`, `OperationBatch`, `RevisionedBatch`, `BlockLock`, …) are re-exported from `@templatical/editor`.

Breaking changes:

- The `history.collabWarning` string is gone.
- Cloud (experimental, outside semver until Cloud GA): `initCloud()` no longer takes `collaboration` or `mcp`, and its peer-to-peer collaboration, collaborator bar, collaborative undo warning and MCP listener are removed, with the cloud chunk's `collaboration` strings.
