---
"@templatical/editor": minor
---

`init({ ai })`: bring your own AI backend. Each feature is labelled as AI, in every editor locale:

- **The AI assistant:** a chat that edits the template, one undo step per turn, starting from static, localized starters. With `chatAttachments: true` it takes PNG, JPEG, WebP or GIF images and PDFs: at most 4 per message, each at most 5 MB, 10 MB together. The header's AI button opens and closes it. On an empty template, "Import from screenshot or PDF" opens the file picker and prefills a request the author sends.
- **Rewrite** in the paragraph toolbar.
- **Fix with AI** on the lint findings in `AI_FIXABLE_RULES`, from the Issues panel.
- **Write alt text** for one image, or for every image the alt rules in `AI_ALT_TEXT_RULES` flag, through a review list. Nothing is written before Apply.

Fix with AI and Write alt text need `@templatical/quality` with lint on. With collaboration, the AI's edits travel as the user's batches marked `origin: 'ai'`, and other editors show "AI (for Ada) …".

AI contract types are re-exported from `@templatical/editor`. **BYO contract:** editor-applied conversation Undo and Redo answers include `replayId`. The editor calls the required `conversation.settleReplay` with its application outcome, and a refusal leaves stored history unchanged.
