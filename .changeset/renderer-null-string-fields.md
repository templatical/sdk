---
"@templatical/renderer": patch
---

A string field stored as `null` or left out renders as an empty string instead of throwing. Templates saved by a backend that turns every `""` into `null` failed with `Cannot read properties of null (reading 'replace')` on, for example, an image without alt text. This covers image and video `alt`, `src`, `url` and `align`, button `text`, `url` and colours, title, paragraph, HTML and table cell content, divider, menu, social and table fields, and the template's `backgroundColor` and `fontFamily`. An image whose `src` is `null`, and a paragraph or HTML block whose content is `null`, renders nothing, as with `""`. `escapeHtml`, `escapeAttr`, `escapeCssValue` and `escapeFontFamily` accept `null` and `undefined` and return `""`. Output for every other value is unchanged.
