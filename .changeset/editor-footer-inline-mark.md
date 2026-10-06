---
"@templatical/editor": patch
---

The editor footer draws the Templatical mark inline instead of loading `https://templatical.com/logo.svg`, so `init()` makes no requests to Templatical. The footer no longer carries an "Open Source" link: the editor is source-available under FSL-1.1-MIT. `branding: false` still hides the footer.
