---
"@templatical/import-beefree": patch
---

A plain `<code>` around one merge tag without `data-bee-type` drops its plain leading space again, wherever it sits: `SIM-Karten:<code> {{anzahl}}</code>` imports as `SIM-Karten:<code>{{anzahl}}</code>`.

BeeFree's own HTML export writes a plain `<code>` without that space. Version 0.60.2 kept it after text, adding a space absent from BeeFree's export. BeeFree's export keeps the space after text for a `<code data-bee-type="mergetag">` chip, so chips keep the 0.60.2 rule.
