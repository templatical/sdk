---
"@templatical/editor": patch
---

Fix input fields overflowing their container in the template settings panel and other sidebars (issue #115).

Root cause: Tailwind preflight is disabled (intentional — see CLAUDE.md), so `box-sizing: border-box` was never applied to form elements. The hand-rolled `.tpl` reset block reset `font-family` and button chrome but not `box-sizing`. With `tpl:w-full` (`width: 100%`) plus a horizontal padding utility like `tpl:px-3.5` (28px total), inputs resolved to `content-box` and extended their padding beyond the parent — most visible in the 320px right sidebar.

Fix: add `box-sizing: border-box` to the form-element reset in `packages/editor/src/styles/index.css`. Affects every `<input>`, `<select>`, `<textarea>`, and `<button>` under `.tpl`. Also resolves the social-toolbar slider/number-input misalignment reported in the same issue.

Regression locked by `packages/editor/tests/formResetStyles.test.ts`.
