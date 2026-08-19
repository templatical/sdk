---
"@templatical/editor": patch
---

Work around a Chromium bug (verified in Chromium 140–151, including stable Chrome) where pressing End or Home shortly after triple-clicking inside a text block armed a native scroll: the next typed character smooth-scrolled the canvas to its very bottom (End) or top (Home), dragging the caret out of view. Rich-text blocks now handle plain End/Home through `Selection.modify` — identical visual-line caret movement, without arming the bug. Shift+End/Home selection extension keeps its native behavior.
