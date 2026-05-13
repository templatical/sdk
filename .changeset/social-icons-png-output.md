---
"@templatical/renderer": patch
"@templatical/editor": patch
---

Render social icons as hosted PNGs instead of inline SVG data URIs so they display in Outlook desktop (the Word rendering engine has no SVG support and rejects base64 in `<img src>`). PNGs are shipped with the npm package and served via the version-pinned unpkg URL by default; override via the new `RenderOptions.socialIconsBaseUrl` to self-host. Replace the Style segmented control in the social icons sidebar with a native dropdown so the 5-option list no longer overflows the sidebar.
