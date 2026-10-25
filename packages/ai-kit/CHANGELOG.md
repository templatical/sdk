# @templatical/ai-kit

## 0.50.0

### Minor Changes

- 61518b7: New package `@templatical/ai-kit`, MIT and with no LLM SDK dependency: the editor's AI over your own backend.

  - **Client:** `createHttpAiProvider`, an `AiProvider` over a documented REST and SSE wire. A chat message with attachments goes as multipart, with one `attachment` part per file.
  - **Server kit:** `readAiRequest`, the prompts, the `apply_operations` tool (`applyOperationsTool`), `runEditingTurn`, `aiEventStream` for any Fetch API server, error responses, and the output checks `checkRewrite` and `checkAltText`.
  - **Test kit:** `runAiProviderConformance` and `runAiWireConformance`; `createMockAiProvider` with recorded streams (`AI_RECORDINGS`); and an eval set of edit, fix and alt-text cases, run with `runAiEvalSet`, `evalTurnWith` and `evalAltTextWith`. The eval fixtures ship in `eval/`.

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0
