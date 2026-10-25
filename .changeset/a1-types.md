---
"@templatical/types": minor
---

AI as a bring-your-own contract (**BYO contract**):

- `AiProvider`, with the members `chat`, `fixFinding`, `rewrite` and `altText`, the `chatAttachments` flag and the optional `conversation`, plus their request, handler and result types. These include `AiChatAttachment`, `AiFixFinding` (a JSON subset of a lint finding) and `AiAltTextRequest`.
- `AiChatMessage`, with attachment metadata on user messages; two-phase Undo and Redo settlement (`AiReplayOutcome` and the required `conversation.settleReplay`); and `AiMergeTags`.
- `SdkError` gains `details` and the AI error codes, and `ThrottledError` is new.
- **BYO contract:** `OperationBatch.origin` (`'ai'`) and the `ai` collaboration actor. A collaboration backend that switches on `actor.type` handles `ai`.
- `invertOperations` moves here from `@templatical/core`, which re-exports it.

Require AI merge-tag syntax even when no tags are declared.
