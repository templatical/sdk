---
"@templatical/core": minor
---

The collaboration controller applies an AI turn's operations as this session's batches, marked `origin: 'ai'`, one undo step per turn (`applyOperations`). `invertOperations` is re-exported from `@templatical/types`.


- The collaboration controller sends a history step or edit of more than 100 operations as consecutive batches of at most 100. It remains one undo step; a refused chunk drops the rest of its step. This also fixes large local edits, which 0.49.0 sent as one oversized batch.
- `useEditor().load(templateId, shouldApply?)` accepts an optional guard: a stale response the guard rejects never replaces the loaded template. The editor's AI reload uses it. `useEditor()` also returns `loadVersion`, a counter of committed creates and loads, and `state.isLoading` belongs to the latest request.


**BYO contract:** AI conversation Undo/Redo operations carry a `replayId` and require settlement of the editor's application outcome before changing stored history.
