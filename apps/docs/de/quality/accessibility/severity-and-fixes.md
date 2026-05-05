# Schweregrad & Korrekturen

## Schweregradmodell

Jede Regel emittiert ein `A11yIssue` mit einem von vier Schweregraden:

| Schweregrad | Bedeutung | UI |
|---|---|---|
| `error` | Harter Barrierefreiheits-Fehler. Empfänger könnten von der Nachricht ausgeschlossen werden. | Roter Punkt auf dem Canvas, Gruppe "Fehler" in der Sidebar. |
| `warning` | Wahrscheinliches Problem – beheben, sofern Sie es nicht besser wissen. | Gelber Punkt, Gruppe "Warnungen". |
| `info` | Empfehlung; kein Defekt. | Kein Canvas-Badge, Gruppe "Info". |
| `off` | Override – deaktiviert die Regel komplett. | Nichts. |

Der Schweregrad ist pro Regel über `options.rules` konfigurierbar – die Spalte "Severity" im Katalog ist nur der Standard.

## Auto-Fix

Manche Regeln liefern einen `fix`-Patch, den Nutzer per Klick in der Sidebar anwenden können. Jeder Patch implementiert:

```ts
interface A11yPatch {
  description: string;
  apply: (ctx: A11yPatchContext) => void;
}

interface A11yPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
}
```

Im Editor läuft `apply` durch den vorhandenen `editor.updateBlock` / `updateSettings`-Pfad – der vom History-Interceptor umhüllt ist – sodass jede Korrektur als eigener Undo-Eintrag landet. Nutzer können mit Cmd/Strg+Z eine Korrektur zurücknehmen, ohne umliegende Arbeit zu verlieren.

Headless-Aufrufer können einen eigenen `A11yPatchContext` bauen und Patches programmatisch anwenden:

```ts
import { lintAccessibility } from "@templatical/quality";

const issues = lintAccessibility(content);
const fixable = issues.filter((i) => i.fix);

for (const issue of fixable) {
  issue.fix!.apply({
    updateBlock: (id, patch) => mutateBlock(content, id, patch),
    updateSettings: (patch) => Object.assign(content.settings, patch),
  });
}
```

## Welche Regeln liefern eine Korrektur?

Siehe Spalte **Auto-Fix** im [Regelkatalog](./rule-catalog). Aktuell: `img-alt-is-filename`, `img-decorative-needs-empty-alt` und `link-target-blank-no-rel`. Auto-Fixes werden konservativ ergänzt – nur, wenn die richtige Antwort eindeutig ist.
