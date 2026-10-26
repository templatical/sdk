---
"@templatical/editor": patch
---

The AI header button matches the other header buttons

It now uses the header's compact secondary style, the same as Comments and the test-email button: a 12px medium-weight label on a neutral surface with a border, muted until hover. The Sparkles icon carries the AI signal in `--tpl-primary-hover`, and the open state takes the Comments button's `--tpl-primary-light` fill. The amber fill, the semibold label, the lift-and-glow hover and the animated "comet" border are gone, so Save is the header's only amber surface.

The `tpl-ai-btn`, `tpl-ai-btn--idle`, `tpl-ai-btn--active` and `tpl-ai-btn-icon` classes and the `--tpl-comet-angle` and `--tpl-comet-start` properties no longer exist, so custom CSS that targeted them no longer applies.
