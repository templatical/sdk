---
"@templatical/editor": patch
---

The editor's interface now renders as designed in the default Shadow DOM mount, and on host pages without a CSS reset. A host reset such as Tailwind's preflight hid all of this in light-DOM mounts.

- **Interface:** the sidebars, dialogs, pickers and toolbars now get a reset of their own, scoped to the editor and never applied to the email on the canvas. Before, they rendered with browser defaults:
  - dialog panels grew past their size limits by their padding (the test-email dialog by about 40px each way);
  - titles and help text picked up browser margins (the saved-blocks browser header was 46px taller);
  - buttons used the browser's 13.33px font.
- **Canvas placeholders:** the HTML, image, video and custom-block placeholders were 4–34px taller than designed. They now fit their minimum heights.
- **Spacer:** the dashed guide shown while editing added 2px to the spacer's height and drew 3px dashed borders on its sides. It now sits inside the height, with no side borders.
- **Video:** the thumbnail left a 6px gap below it that the email doesn't have. It now renders `display: block`, as the email's image does.
- **Dialogs:** every dialog's backdrop was 32px taller than the page or host box it covers, so dialogs sat 16px low and lost their bottom 32px inside a clipping host. The backdrop now fits the box it covers.
- **Sidebars:** each sidebar was 1px wider than the canvas leaves for it, so the right one covered the canvas's last pixel column, where a block's drag grip sits.

The email itself renders exactly as before, and the export is unchanged.
