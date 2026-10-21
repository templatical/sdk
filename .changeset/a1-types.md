---
"@templatical/types": minor
---

AI as a bring-your-own contract (**BYO contract**): `AiProvider` and its request, handler and result types, `AiChatMessage`, two-phase Undo/Redo settlement (`AiReplayOutcome` and required `conversation.settleReplay`), `ScoringResult` with three categories, `AiMergeTags`; `SdkError` gains `details` and the AI error codes; `ThrottledError` is new; `OperationBatch.origin` (`'ai'`) and the `ai` collaboration actor; `invertOperations` moves here from `@templatical/core`.
