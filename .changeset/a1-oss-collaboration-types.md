---
"@templatical/types": minor
---

Operations vocabulary v2, the engine that applies it, and the collaboration contract

- `applyOperations(content, ops, { locks, session })` applies a batch of operations — `addBlock`, `moveBlock`, `deleteBlock`, `updateBlock`, `updateSettings`, `setContent` — to a copy, in order and all or nothing, and throws an `OperationError` (`code`, `opIndex`) at the first one it refuses. Positions are anchored to a sibling id, `updateBlock`/`updateSettings` take `set` and `unset`, and `expect` preconditions guard a change against the content having moved on. `applyOperationsInPlace`, `getColumnCount` and `deepEqual` come with it. Templatical Cloud's engine follows the same rules, pinned by the shared cases in `tests/fixtures/operations/` (regenerate their manifest with `pnpm --filter @templatical/types run fixtures:manifest`).
- The bring-your-own collaboration contract: `CollaborationProvider` (`join`, `submit`, `operationsAfter`, and optionally `acquireLock`/`renewLock`/`releaseLock`), `CollaborationHandlers`, `OperationBatch`, `RevisionedBatch`, `CollaborationActor`, `CollaborationMember`, `BlockLock`, `BlockLockHolder`, `CollaborationRemoteChange`, and `CollaborationConflict`, an `SdkError` with `code`, `opIndex`, `holder` and `holders`.
- `CollaborationActor.client` is the agent's name on an `mcp` actor (`Claude`, `Cursor`, …). A collaboration backend that lets agents edit sends it with each agent batch, and the editor names it in a notice.
- `CollaborationHandlers.onResync(revision, actor?)`: the optional `actor` is who caused the re-sync. The editor names an agent's re-sync in a notice.
- `Template` gains `revision` and `locks`.
- `SdkError` takes an optional third argument, `code` (`SdkErrorCode`): the error's code, as `CollaborationConflict` carries it. `SdkErrorCode` is exported from `@templatical/types` and `@templatical/editor`.

Breaking changes:

- `TemplateOperation` and `TemplateOperationPayload` (the v1 vocabulary) are removed; use `Operation`.
