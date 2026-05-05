# Rule catalog

> This page is generated from `@templatical/quality`'s rule definitions. Edit the rule files in `packages/quality/src/accessibility/rules/` and re-run `tsx apps/docs/.vitepress/scripts/generate-rule-catalog.ts` — never edit this file by hand.

19 rules ship in v1.

## Images

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `img-missing-alt` | error | — | Missing alt text — Screen readers announce undefined or empty alt as the image filename or skip the image entirely. Email clients also block images by default; alt text is what 30–50% of recipients see first. [1](https://www.w3.org/WAI/tutorials/images/) |
| `img-alt-is-filename` | warning | yes | Alt text looks like a filename — Filenames like 'IMG_1234.jpg' or 'Screen Shot 2026.png' carry no useful meaning. Replace with a short description of what the image conveys. |
| `img-alt-too-long` | warning | — | Alt text is too long — Screen readers don't pause inside alt text. Long alt strings become a wall of speech. Aim for under ~125 characters; put extra context in surrounding copy. |
| `img-decorative-needs-empty-alt` | info | yes | Decorative image has alt text — Decorative images should be skipped by screen readers. Setting alt='' (empty) signals that intent. Non-empty alt on a decorative image is a contradiction. |
| `img-linked-no-context` | warning | — | Linked image has no destination context — When an image is also a link, alt text doubles as the link label. Describing only what the image shows leaves users guessing where the link goes. |

## Headings

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `heading-empty` | error | — | Heading has no text — Empty headings produce silent landmarks for screen-reader users navigating by heading. Either add text or remove the block. |
| `heading-skip-level` | error | — | Heading level skipped — Skipping heading levels (e.g. H1 → H3) breaks the document outline that assistive tech relies on for navigation. Step one level at a time. |
| `heading-multiple-h1` | warning | — | Multiple H1 headings — An email should have a single H1 that names the message. Multiple H1s confuse the document outline and weaken landmark navigation. |

## Links

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link-empty` | error | — | Link has no accessible text — A link with no visible text and no nested image with alt is invisible to screen readers and unclickable for many users. |
| `link-vague-text` | warning | — | Vague link text — Phrases like 'click here' or 'read more' tell screen-reader users nothing when listed out of context. Use descriptive link text that names the destination. |
| `link-href-empty` | error | — | Link has empty href — An anchor with no destination (empty href or '#') is broken — recipients click and nothing happens, or the page jumps to top. |
| `link-target-blank-no-rel` | warning | yes | target="_blank" missing rel="noopener" — Links opening in a new tab without rel='noopener' or rel='noreferrer' allow the destination to read window.opener and tamper with the originating page. A small but real security/privacy footgun. |

## Text

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `text-all-caps` | warning | — | All-caps body text — Long stretches of all-caps text are read letter-by-letter by some screen readers and slow visual reading by 10–20%. Use sentence case for body copy; reserve caps for short labels. |
| `text-low-contrast` | error | — | Text contrast is too low — WCAG AA requires 4.5:1 contrast for body text and 3:1 for large text (≥18px, or ≥14px bold). Below that, text becomes unreadable for low-vision users and in bright outdoor light. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |
| `text-too-small` | warning | — | Text is too small — Email body text below 14px becomes hard to read on mobile. Some clients also auto-zoom or scale up small fonts in unpredictable ways. Stay at 14px or larger. |

## Buttons

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `button-vague-label` | warning | — | Vague button label — A button labeled 'Click here' or 'Submit' tells the user nothing about what will happen. Use action-oriented labels that name the outcome ('Buy ticket', 'Reset password'). |
| `button-touch-target` | warning | — | Button touch target is too small — WCAG 2.5.5 (AAA) and Apple/Google UX guidelines recommend touch targets of at least 44×44px. Smaller buttons cause mis-taps on mobile. |
| `button-low-contrast` | error | — | Button text contrast is too low — WCAG AA requires a 4.5:1 contrast ratio between body text and its background. Buttons that fail this become unreadable for users with low vision and in bright outdoor light. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |

## Structure

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `missing-preheader` | info | — | Missing preheader text — The preheader is the preview snippet shown beside the subject line in most inboxes. Without it, recipients see a fragment of the first heading or a stray alt tag — a missed chance to set context. |

