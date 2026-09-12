---
title: Template Tools
description: API-Referenz für @templatical/template-tools — die CLI und Bibliothek zum Validieren, Rendern, Bearbeiten, Importieren und Live-Vorschauen von Templatical-Templates außerhalb des Editors.
---

# Template Tools

`@templatical/template-tools` ist die CLI und Bibliothek hinter jeder mechanischen Operation auf einem Templatical-Template: sein JSON validieren, es zu MJML oder HTML rendern, eine gezielte Änderung anwenden, es aus dem Exportformat eines anderen Editors importieren, oder es live im echten Templatical-Editor anzeigen. MIT-lizenziert, auf npm veröffentlicht, und läuft über `npx`, ohne dass irgendetwas in Ihr Projekt installiert wird und ohne Templatical-Konto.

Der mitgelieferte [Agent Skill](/de/guide/agent-skill) steuert diese CLI intern — jeder Befehl, den ein KI-Coding-Agent beim Bauen oder Bearbeiten eines Templates mit dem Skill ausführt, ist einer der sieben unten dokumentierten. Die CLI selbst braucht keinen Agenten: Alles hier funktioniert genauso aus einer Shell, einem Skript oder einem CI-Job.

## Aufruf

Jeder Befehl hat dieselbe Form:

```bash
npx -y @templatical/template-tools <command> [options]
```

Mit `--json` gibt jeder Befehl ein einzelnes, parsebares JSON-Dokument auf stdout aus. Als Projekt-Abhängigkeit installiert heißt die ausführbare Datei `templatical`.

**Pinnen Sie in CI eine exakte Version.** Die CLI und das Blockmodell, gegen das sie validiert (`@templatical/types`), werden gemeinsam veröffentlicht — ein Aufruf ohne Version passt also immer zu sich selbst, kann aber zwischen zwei Durchläufen strenger werden, ohne dass eine Änderung von Ihnen das erklärt. Mit einer gepinnten Version wird ein Versionssprung zu einem überprüfbaren Diff.

## Befehle

| Befehl | Funktion |
|---|---|
| `validate <file>` | Strukturprüfung, dann der Qualitäts-Lint |
| `schema [--out <file>]` | Gibt das Block-JSON-Schema aus |
| `render <file> [--format mjml\|html] [-o <file>]` | Rendert zu MJML oder zu versandfertigem HTML |
| `edit <file> --op '<json>'` \| `--ops <file>` | Wendet eine Operation oder einen Batch an und schreibt das Ergebnis |
| `import <file> [--format <fmt>]` \| `--list-formats` | Konvertiert ein Design aus einem anderen Tool in Templatical-JSON |
| `live` \| `live reload` \| `live stop` | Zeigt das Template live im echten Editor an, inklusive Handbearbeitung |
| `list` | Listet die Arbeits-Templates in `.templatical/` |

`--json` (siehe unten) ist ein globales Flag — es funktioniert bei jedem der obigen Befehle identisch, nicht nur bei einigen. Jeder Befehl, der eine Datei anfasst, akzeptiert außerdem `--cwd <dir>` und löst relative Pfade dagegen auf, statt gegen das eigene Arbeitsverzeichnis des Prozesses.

### `validate <file>`

```bash
npx -y @templatical/template-tools validate emails/welcome.json
```

Strukturelle Validierung gegen das generierte JSON-Schema — diskriminator-bewusst, sodass ein fehlerhafter Button `blocks[2] (button) must have required property 'url'` meldet statt eines rohen `anyOf`-Fehlers. Sobald die Struktur besteht, läuft darauf der vollständige Lint von `@templatical/quality` (Barrierefreiheit, Struktur, Links — 31 Regeln). Keine befehlsspezifischen Flags.

### `schema [--out <file> | -o <file>]`

```bash
npx -y @templatical/template-tools schema --out block-schema.json
```

Gibt dasselbe JSON-Schema aus, gegen das `validate` prüft — das Blockmodell als reines JSON-Schema-Dokument, nützlich, um einen LLM-Prompt zu grounden oder Typen in einer anderen Sprache zu generieren. Ohne `--out`/`-o` wird auf stdout ausgegeben; damit wird stattdessen in diese Datei geschrieben (übergeordnete Verzeichnisse werden bei Bedarf angelegt), und es erscheint nichts auf stdout.

### `render <file> [--format mjml|html] [--out <file> | -o <file>]`

```bash
npx -y @templatical/template-tools render emails/welcome.json --format html -o welcome.html
```

Standardmäßig `--format mjml`. `--format html` kompiliert dieses MJML weiter und benötigt das optionale Paket `mjml` — siehe „Optionale Abhängigkeiten" unten. Das Template wird vor dem Rendern strukturell validiert, sodass ein ungültiges Template mit derselben Fehlerliste scheitert, die auch `validate` liefern würde, statt mit einem Renderer-Absturz. Ohne `--out`/`-o` erscheint das Ergebnis auf stdout.

### `edit <file> --op '<json>'` oder `--ops <file>`

```bash
npx -y @templatical/template-tools edit emails/welcome.json \
  --op '{"operation":"updateBlock","data":{"blockId":"button_1","updates":{"backgroundColor":"#1d4ed8"}}}'
```

Eine Operation über `--op '<json>'`, oder ein Batch über `--ops <file>`, das auf ein JSON-Array derselben Form zeigt — nie beides. Jede Operation hat die Form `{ "operation": "<name>", "data": {...} }`, wobei `operation` eine der sieben Operationen ist, die der Editor selbst verwendet: `addBlock`, `updateBlock`, `deleteBlock`, `moveBlock`, `updateSettings`, `setContent`, `updateBlockStyle`.

Ein Batch ist alles-oder-nichts: Die erste Operation, die abgelehnt würde, stoppt den ganzen Batch, es wird nichts geschrieben, und der Fehler benennt, welche Operation (nach Index) und warum. Selbst wenn jede Operation eines Batches erfolgreich ist, wird das Ergebnis vor dem Schreiben noch einmal strukturell validiert — eine Abfolge, die ein ungültiges Dokument erzeugt, wird abgelehnt, und die Datei bleibt unangetastet. Bei Erfolg überschreibt `edit` `<file>` direkt; es gibt kein `--out`.

### `import <file> [--format <fmt>] [--out <name>]` oder `import --list-formats`

```bash
npx -y @templatical/template-tools import design.json --format unlayer
```

Konvertiert ein Design aus dem Exportformat eines anderen Tools in ein neues Templatical-Template, geschrieben nach `.templatical/<name>.json` (`<name>` ist standardmäßig der Basisname von `<file>`; überschreiben Sie ihn mit `--out <name>`). Ohne `--format` erkennt `import` das Format anhand der Dateiendung und des Inhalts — für die meisten Exporte zuverlässig, aber geben Sie `--format` explizit an, wenn die Erkennung danebenliegt. Das Ergebnis enthält einen Konvertierungsbericht: wie viele Blöcke sauber konvertiert wurden, wie viele angenähert wurden, wie viele auf einen rohen HTML-Block zurückgefallen sind und wie viele übersprungen wurden.

Führen Sie `import --list-formats` aus (optional mit `--json`), um zu sehen, welche Konverter-Pakete gerade tatsächlich aus Ihrem aktuellen Arbeitsverzeichnis auflösbar sind — siehe „Optionale Abhängigkeiten" unten.

### `live` · `live reload` · `live stop`

Startet einen lokalen Server, der den echten Templatical-Editor (von der CDN geladen) in Ihrem Browser öffnet und eine Arbeits-Template-Datei in `.templatical/` per Server-Sent Events synchron hält. `live reload` überträgt Ihre letzte Änderung auf die geöffnete Seite; `live stop` beendet den Server. `[--file <f>]` wählt die Arbeitsdatei, `[--port <n>]` wählt den Port (Standard `4747`, mit Rückfall auf einen zufälligen freien Port, falls belegt), `[--cwd <d>]` löst beides gegen ein anderes Verzeichnis als das aktuelle auf, und `--no-open` überspringt das automatische Öffnen eines Browsers. Das ist das Protokoll, auf dem der Live-Modus des [Agent Skill](/de/guide/agent-skill) aufbaut — dort steht, wie ein Agent es Zug um Zug steuert; der CLI-Befehl hier startet und stoppt nur den Server.

### `list`

```bash
npx -y @templatical/template-tools list
```

Listet jedes Arbeits-Template unter `.templatical/` (oder dem `.templatical/` von `--cwd`) auf, mit einem Titel-Hinweis aus dem jeweils ersten gefundenen Title-Block. Nützlich, um sich an den Dateinamen zu erinnern, an dem Sie gerade gearbeitet haben.

## Exit-Codes

| Code | Bedeutung |
|---|---|
| `0` | Erfolg. `validate` kann trotzdem `warning`-/`info`-Probleme melden — siehe unten. |
| `1` | Das Template ist ungültig: ein struktureller Fehler, oder ein Lint-Problem mit Schweregrad `error`. |
| `2` | Fehlerhafte Nutzung — falsche Flags, ein fehlendes Argument, eine unlesbare oder nicht parsbare Eingabedatei. |
| `3` | Eine optionale Abhängigkeit ist nicht installiert. Die Fehlermeldung nennt den genauen Installationsbefehl. |

::: tip Exit-Code 3 ist kein Fehlschlag
Er bedeutet, dass die CLI ihre Arbeit getan hat und dabei auf einen wirklich optionalen Baustein gestoßen ist, ohne den es nicht weitergeht — das Paket `mjml` für `render --format html`, oder ein Konverter-Paket für `import`. Behandeln Sie ihn in jedem Skript oder CI-Schritt anders als `1`/`2`: `3` bedeutet „ein Paket installieren und erneut ausführen", nicht „mit diesem Template stimmt etwas nicht".
:::

## Die `--json`-Ausgabe lesen

Die `--json`-Ausgabe jedes Befehls ist genau ein parsbares Dokument auf stdout — in diesem Modus wird dort sonst nichts geschrieben. Diagnosen, Fortschrittsmeldungen und menschenlesbare Fehler gehen stattdessen auf stderr, in beiden Modi — `<Befehl> --json | jq .` lässt sich also immer gefahrlos pipen.

`validate --json` liefert `{ valid, errors, issues }`. `errors` ist die Liste der Strukturfehler, nur gefüllt, wenn `valid` auf `false` steht. `issues` ist der vollständige Bericht von `@templatical/quality` zum Template — jedes Barrierefreiheits-, Struktur- und Link-Problem, mit dem Schweregrad, den die jeweilige Regel standardmäßig hat (`error`, `warning` oder `info`) — unabhängig davon, ob dieses Problem den Exit-Code beeinflusst hat.

**Der Stolperstein:** `issues.length > 0` bedeutet nicht „das Template ist gescheitert". Die meisten Regeln stehen standardmäßig auf `warning` oder `info` und sind rein beratend. Eine Handvoll — fehlender `alt`-Text bei Bildern, eine `javascript:`-URL, eine doppelte Block-ID, zu geringer Kontrast und ein paar weitere — steht standardmäßig auf `error`, und die lassen den Befehl tatsächlich scheitern: `validate` hat das bereits für Sie berechnet, wofür genau der Exit-Code da ist (`1` bei einem strukturellen Fehler oder einem Problem mit `severity: "error"`, sonst `0`). Ein CI-Skript, das den Build allein deshalb scheitern lässt, weil das `issues`-Array nicht leer ist, weist Templates zurück, die der Befehl selbst als bestanden einstuft. Vertrauen Sie dem Exit-Code — oder dem obersten `valid`-Feld, wenn Sie es im selben Prozess brauchen — statt selbst eine „jedes Problem lässt scheitern"-Prüfung gegen `issues` zu bauen.

## Einsatz in CI

Ein minimaler Pull-Request-Check — kein Installationsschritt für die CLI selbst, weil es keinen gibt:

```yaml
name: Validate email templates

on:
  pull_request:
    paths:
      - "emails/**/*.json"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Validate templates
        run: |
          for file in emails/*.json; do
            npx -y @templatical/template-tools validate "$file"
          done
```

Passen Sie das Glob-Muster an den Ort an, an dem Ihre Templates tatsächlich liegen. GitHub Actions führt das Skript eines `run:`-Schritts standardmäßig mit `bash -e` aus, sodass die Schleife beim ersten nicht validierenden Template stoppt und der Schritt fehlschlägt — hier verfolgt nichts von Hand einen Exit-Status. Binden Sie den `npx`-Aufruf hier an eine exakte Version, wie oben unter „Aufruf" beschrieben, damit ein template-tools-Release nicht ohne überprüfbaren Diff ändern kann, was „bestanden" für diesen Workflow bedeutet.

## Optionale Abhängigkeiten

Das Ausführen der CLI installiert von sich aus nie etwas in Ihr Projekt — `npx` löst nur das Paket selbst auf (aus npms Cache, oder durch einmaliges Abrufen beim ersten Mal), und das ist die einzige Netzwerk- oder Dateisystemaktivität, die ein einfacher Befehl auslöst. Zwei Befehle können jeweils genau ein weiteres Paket verlangen, und der Fehler nennt den Installationsbefehl, wenn es fehlt:

- **`render --format html`** braucht `mjml`. Der Renderer erzeugt ausschließlich MJML — dieses SDK bündelt bewusst keinen eigenen MJML-zu-HTML-Compiler —, sodass eine MJML-Implementierung nötig ist, um daraus versandfertiges HTML zu machen, und `mjml` ist diejenige, die dieser Befehl zu laden weiß.
- **`import`** braucht das Konverter-Paket für das jeweilige Format, das Sie importieren.

Raten Sie bei `import` nicht, welche Konverter installiert sind — fragen Sie die CLI:

```bash
npx -y @templatical/template-tools import --list-formats --json
```

Das meldet exakt, was gerade aus Ihrem aktuellen Arbeitsverzeichnis auflösbar ist. Die Liste der Konverter wächst mit der Zeit, daher ist das die einzige Antwort, die nicht veralten kann — anders als eine fest eingetragene Liste auf einer Doku-Seite.

Installieren Sie jede Art optionaler Abhängigkeit in dem Projekt, aus dem heraus die CLI aufgerufen wird — beide werden ausgehend von Ihrem aktuellen Arbeitsverzeichnis aufgelöst (oder `--cwd`, falls angegeben).

## Nutzung als Bibliothek

Drei Einstiegspunkte für drei verschiedene Aufgaben.

### `@templatical/template-tools` (Root)

```ts
import {
  schema,
  validateTemplate,
  runQualityLint,
  applyOperation,
  getColumnCount,
  type ValidationResult,
  type QualityLintResult,
  type OperationResult,
} from "@templatical/template-tools";
```

- **`schema`** — das generierte JSON-Schema für `TemplateContent`, als einfaches Objekt. Derselbe Inhalt, den der Befehl `schema` ausgibt und den die veröffentlichte Datei `schema.json` (unten) enthält.
- **`validateTemplate(data: unknown): ValidationResult`** — dieselbe diskriminator-bewusste Strukturprüfung, die `validate` ausführt. Synchron; braucht nur `ajv` und das eingecheckte Schema, keinen Build-Schritt und kein weiteres Workspace-Paket.
- **`runQualityLint(data: unknown): QualityLintResult`** — der `lintTemplate` von `@templatical/quality`, darübergelegt, unter der Annahme strukturell gültiger Eingabe. In try/catch eingehüllt, sodass ein fehlerhaftes Template den Aufrufer nicht abstürzen lassen kann: `{ issues, error? }`, wobei `error` nur gesetzt ist, wenn der Linter selbst einen Fehler geworfen hat.
- **`applyOperation(content: TemplateContent, payload: TemplateOperationPayload): OperationResult`** — der reine Reducer hinter `edit --op`. Verändert `content` nie; liefert `{ ok, content, error? }`, wobei `content` bei einer Ablehnung dasselbe Objekt ist, das übergeben wurde, nachweislich unangetastet.
- **`getColumnCount(layout: ColumnLayout): number`** — Anzahl der Spalten, die ein Section-Layout deklariert: `'1'` → `1`, `'3'` → `3`, alles andere (`'2'`, `'2-1'`, `'1-2'`) → `2`. Spiegelt den identischen Helfer im eigenen Editor von `@templatical/core`, hier neu implementiert, weil dieses Paket core nie importiert — siehe „Verhältnis zu den anderen Paketen" unten.

### `@templatical/template-tools/live`

```ts
import { startBridge } from "@templatical/template-tools/live";
```

Nur für Node (`node:http`, `node:fs`) — ein eigener Subpath, damit ein Bundler, der für den Browser baut, diese Built-ins nie auflösen muss, nur weil er den Root-Export importiert hat. `startBridge(options?)` startet denselben lokalen Bridge-Server, den der Befehl `live` umschließt: Er liefert das CDN-Editor-Harness aus und hält eine Arbeits-Template-Datei damit synchron. Das zurückgegebene Handle stellt `reload()` und `getEditorState()` direkt bereit, sodass ein Aufrufer, der bereits im selben Node-Prozess läuft, die Bridge steuern und ihren Divergenz-Zustand auslesen kann, ohne einen HTTP-Roundtrip zu seinem eigenen Server zu machen. Die meisten Konsumenten brauchen das nicht direkt — daraus ist `live` gebaut.

### `@templatical/template-tools/schema.json`

Das rohe, generierte JSON-Schema als `.json`-Datei — importierbar überall, wo Ihr Bundler oder Ihre Laufzeitumgebung JSON laden kann (`import schema from "@templatical/template-tools/schema.json"`, oder außerhalb eines Bundlers mit `fetch`/`fs.readFileSync` gelesen). Inhaltlich identisch mit dem `schema`-Export oben und mit dem, was der Befehl `schema` ausgibt.

**Bauen Sie eine eigene „Mit KI generieren"-Funktion in Ihr Produkt?** Das ist, was Sie dafür brauchen. Der mitgelieferte [Agent Skill](/de/guide/agent-skill) durchläuft genau diese Schleife für einen Coding-Agenten: das Block-Schema als Grounding lesen, ein Template generieren, das Ergebnis validieren und etwaige Fehler an das Modell zurückgeben, bis es besteht. `schema.json` und `validateTemplate` sind die beiden Teile dieser Schleife, die dieses Paket Ihnen direkt an die Hand gibt — geben Sie das Schema an Ihr Modell weiter (ein System-Prompt, eine Tool-Definition, ein Structured-Output-Modus, was auch immer Ihr Anbieter unterstützt), und lassen Sie dessen Ausgabe dann durch `validateTemplate` laufen, bevor Sie ihr vertrauen. Alles andere in diesem Paket ist für diesen Weg irrelevant: `runQualityLint`, `applyOperation` und `./live` setzen alle bereits ein strukturell gültiges Template voraus.

## Verhältnis zu den anderen Paketen

Baut auf drei MIT-Paketen auf, allesamt echte `dependencies` statt Peers, also keines davon optional: `@templatical/types` für das Blockmodell, aus dem das Schema generiert wird, `@templatical/quality` für den Lint, den `validate` darüberlegt, und `@templatical/renderer` für die MJML-Ausgabe, die `render` erzeugt. Es ist nicht der Editor — dieses Paket hat keine visuelle Oberfläche, und nichts darin mountet UI oder fasst ein DOM an.

Es importiert nie `@templatical/core`, das einzige SDK-Paket, das noch unter [FSL-1.1-MIT](/de/license-faq) statt reinem MIT steht. Der Operation-Reducer von `edit` (`applyOperation`) implementiert dieselben Invarianten neu, die die eigenen Editor-Mutatoren von core durchsetzen — allen voran, dass eine Sektion nie in einer Spalte landen kann, weil MJML das Verschachteln von `mj-section` in `mj-column` verbietet —, statt sie zu importieren. Das ist ein echter Wartungsaufwand: Die beiden Implementierungen können auseinanderdriften, weshalb die eigene Testsuite dieses Pakets beide Beschreibungen jeder Invariante gegeneinander prüft. Was das zurückbringt, ist genau das, was die Lizenz dieses Pakets rein MIT hält — sicher über ein bloßes, unauthentifiziertes `npx` auszuführen, ohne Lizenzbedingungen jenseits von MIT abwägen zu müssen.
