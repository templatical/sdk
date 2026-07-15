---
"@templatical/media-library": patch
---

Fix: media-library form controls size with `border-box` and show a keyboard focus ring

This package's shared `.tpl` form-element reset diverged from the editor's in two ways. It omitted `box-sizing: border-box`, so — with Tailwind preflight disabled — a padded `tpl:w-full` input resolved to `width: 100%` + horizontal padding and could overflow its parent (the issue #115 class of bug). It also set `outline: none` unconditionally on every `.tpl button`, removing the keyboard focus ring entirely (an accessibility regression). The reset now matches the editor's: `box-sizing: border-box` on the form-control group, and `outline: none` scoped to `:where(.tpl) button:focus-visible` (plus input/select/textarea) paired with the existing `--tpl-ring` box-shadow so keyboard focus stays visible.
