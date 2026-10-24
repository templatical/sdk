---
"@templatical/core": minor
---

The collaboration controller applies an AI turn's operations as this session's batches, marked `origin: 'ai'`, one undo step per turn (`applyOperations`). `invertOperations` now comes from `@templatical/types`; core re-exports it.

- The collaboration controller sends a history step or an edit of more than 100 operations as consecutive batches of at most 100. It stays one undo step, and a refused chunk drops the rest of its step. This also fixes large local edits, which 0.49.0 sent as one oversized batch.
- `useEditor().load(templateId, shouldApply?)` takes an optional guard: a stale response the guard rejects never replaces the loaded template. The editor's AI reload uses it. `useEditor()` also returns `loadVersion`, a counter of committed creates and loads, and `state.isLoading` belongs to the latest request.

**BYO contract:** AI conversation Undo and Redo operations carry a `replayId`, and need the editor's application outcome settled before stored history changes.
