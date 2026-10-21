---
"@templatical/editor": minor
---

`init({ ai })`: bring your own AI backend. A chat that edits the template with Undo, rewrite in the paragraph toolbar, a template score with one-click fixes, starter suggestions and design to template from an image or a PDF, labelled as AI, in every editor locale. With collaboration, the AI's edits travel as the user's batches marked `origin: 'ai'`, and other editors show "AI (for Ada) …".


AI contract types are re-exported from `@templatical/editor`. **BYO contract:** editor-applied conversation Undo/Redo answers include `replayId`; the editor calls the required `conversation.settleReplay` with its application outcome, leaving stored history unchanged after a refusal.
