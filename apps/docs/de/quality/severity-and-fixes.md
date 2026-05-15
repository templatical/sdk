# Schweregrade & Fixes

Beide Linter teilen sich dasselbe Schweregrad-Modell und dieselbe Patch-Struktur, daher behandelt diese Seite `lintAccessibility` und `lintStructure` gemeinsam.

## Schweregrad-Modell

Jede Regel emittiert ein `LintIssue` mit einem von vier Schweregraden:

| Schweregrad | Bedeutung | UI |
|---|---|---|
| `error` | Harter Defekt. Empfänger könnten ausgeschlossen sein, oder das Template ist strukturell beschädigt. | Roter Punkt auf dem Canvas, „Fehler"-Gruppe im Issues-Panel. |
| `warning` | Wahrscheinliches Problem — beheben, außer du weißt es besser. | Gelber Punkt, „Warnungen"-Gruppe. |
| `info` | Empfehlung; kein Defekt. | Kein Canvas-Badge, „Hinweise"-Gruppe. |
| `off` | Override — deaktiviert die Regel komplett. | Nichts. |

Schweregrade sind pro Regel über `options.rules` konfigurierbar — die dokumentierten Defaults sind nur die Basislinie.

## Auto-Fix

Einige Regeln liefern einen `fix`-Patch mit, den der Nutzer mit einem Klick aus dem Issues-Panel anwenden kann. Jeder Patch implementiert:

```ts
interface LintPatch {
  description: string;
  apply: (ctx: LintPatchContext) => void;
}

interface LintPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
  removeBlock: (blockId: string) => void;
}
```

Im Editor läuft `apply` über den bestehenden `editor.updateBlock` / `editor.updateSettings` / `editor.removeBlock`-Pfad — der vom History-Interceptor umschlossen ist — sodass jeder Fix als eigener Undo-Eintrag landet. Nutzer können einen Fix per Cmd/Ctrl+Z rückgängig machen, ohne umliegende Arbeit zu verlieren.

Headless-Aufrufer können einen eigenen `LintPatchContext` konstruieren und Patches programmatisch anwenden:

```ts
import { lintAccessibility, lintStructure } from "@templatical/quality";

const issues = [
  ...lintAccessibility(content),
  ...lintStructure(content),
];
const fixable = issues.filter((i) => i.fix);

for (const issue of fixable) {
  issue.fix!.apply({
    updateBlock: (id, patch) => mutateBlock(content, id, patch),
    updateSettings: (patch) => Object.assign(content.settings, patch),
    removeBlock: (id) => removeBlockFromTree(content, id),
  });
}
```

## Welche Regeln haben einen Fix?

Siehe die **Auto-Fix**-Spalte in den jeweiligen Katalogen. Aktuell mit Auto-Fix:

- Barrierefreiheit — `a11y.img-alt-is-filename`, `a11y.img-decorative-needs-empty-alt`, `a11y.link-target-blank-no-rel`.
- Struktur — `structure.empty-section`.

Auto-Fixes werden konservativ ergänzt — nur wenn die richtige Antwort eindeutig ist. `structure.empty-column` hat z. B. keinen Auto-Fix, weil das Entfernen einer leeren Spalte das `columns`-Layout der Sektion ändern muss und die richtige Antwort (in Nachbar-Spalte zusammenführen vs. Sektion entfernen vs. Layout-Key ändern) von der Intention abhängt.
