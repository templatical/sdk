---
"@templatical/renderer": minor
"@templatical/import-mjml": patch
---

An image set narrower than its column keeps its width on phones (#861). The renderer set `fluid-on-mobile` on every `mj-image` through `<mj-attributes>`, so a 120px logo grew to the whole column on a phone while the editor's mobile preview showed it at 120px, and an image with a set height was stretched out of shape (120×40 became 355×40 on a 375px phone). The attribute is now set per image, only on one that fills its column on desktop: `width: "full"`, or a pixel width at or above the room MJML gives it, which is the column less the side padding and border of the wrapper band, the section and the image. Images wider than the phone still shrink to fit, and video thumbnails follow the same rule.

`RenderContext` gains `contentWidth`, the whole pixels MJML gives a column's content. `containerWidth` keeps its value, the column's share of the body width. The rule is exported as `fluidOnMobileAttr(block, context)`.

A `blockRenderers` entry that emits its own `mj-image` no longer inherits `fluid-on-mobile`. Add `${fluidOnMobileAttr(block, ctx)}` to it, or `fluid-on-mobile="true"`, if the image should fill its column on phones.

`convertMjmlTemplate` reports an `mj-image` as `approximated` when it asks for `fluid-on-mobile` but is narrower than its column, since Templatical keeps such an image at its width on phones. That includes the attribute set for every image through `<mj-attributes>`, as MJML exported from earlier versions of the renderer has it.
