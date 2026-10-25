---
title: "@templatical/ai-kit"
description: Das KI-Protokoll, ein HTTP-Provider, ein Server-Kit mit Prompts und Tools und eine Konformitätssuite. MIT.
---

# @templatical/ai-kit

::: code-group

```bash [npm]
npm install @templatical/ai-kit
```

```bash [pnpm]
pnpm add @templatical/ai-kit
```

```bash [yarn]
yarn add @templatical/ai-kit
```

```bash [bun]
bun add @templatical/ai-kit
```

:::

MIT, ohne LLM-SDK und ohne reine Node-API: Web Streams und `fetch`, sodass derselbe Code in Node, Deno, Bun, Cloudflare Workers und Browsern läuft.

## Anfrage-, Ergebnis- und Verlaufsfelder

Die vollständigen Provider-Deklarationen aus `@templatical/types` enthalten Anfragen, Ergebnisse, Handler und Verlauf einschließlich `AiChatAttachment` und `AiAltTextRequest`. `conversation.list` liefert Nachrichten vom ältesten zum neuesten Eintrag; `createdAt` ist ISO 8601. `batches` ist für Benutzernachrichten leer; `revision` ist für editorseitige Batches `null`, für serverseitige Batches eine Zahl. Nur Benutzernachrichten haben optionale Anhang-Metadaten, keine Dateien.

<<< @/snippets/ai-contract.ts

### Anfragelimits

| Feld | Grenze und Darstellung |
| --- | --- |
| `content` | Serialisiertes JSON mit höchstens 200.000 UTF-8-Bytes; kein Beleg für Schema-Validität |
| `revision` | Nicht negative Ganzzahl oder `null` ohne Zusammenarbeit |
| `message` | 1–4.000 Codepoints, nicht nur Leerraum |
| `selectedBlockId`, `sessionId` | Höchstens 200 Codepoints; Auswahl kann `null` sein |
| `mergeTags` | Erforderliches `{ syntax, tags }`; `tags: []`, wenn keine deklariert sind; höchstens 500 Tags; Syntax `liquid`, `handlebars`, `mailchimp`, `ampscript` oder `custom` |
| Merge-Tag-Felder | `value` ≤ 200, `label` ≤ 100, optional `group` ≤ 100 und `description` ≤ 200 Codepoints; keine Samples oder Callbacks |
| Rewrite | `html` 1–20.000 Codepoints; `instruction` ≤ 500; mindestens `preset` oder `instruction`; `language` bei `translate` erforderlich passend zu `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/` |
| Fix-Befund | [Lint-Fixes](#lint-fixes) nennt alle Feldlimits und ausgeschlossenen Felder |
| Alt-Text | [Alt-Text](#alt-text) nennt URL-, Kontext-, Locale- und Ausgabelimits |
| Anhänge | [Chat-Anhänge](#chat-anhange) nennt MIME-Typen, Dateinamen- und Bytegrenzen |
| Operationsbatch | 1–100 Operationen in Reihenfolge; die Batches eines Durchlaufs bilden einen Rückgängig-Schritt |

`mergeTags` enthält immer die Syntax des Editors (standardmäßig `liquid`), auch bei leerer Tag-Liste. `readAiRequest` lehnt fehlenden oder `null`-Kontext mit Status 422 und der Meldung `mergeTags must be { syntax, tags } with at most 500 tags.` ab. Die Editing-Session und `checkRewrite` lehnen erfundene Tags auch bei leerer deklarierter Liste ab; bereits in der Eingabe vorhandene Tags bleiben erlaubt. Die Syntax `custom` wird nicht geprüft, da ihre Muster nicht an das Backend gesendet werden.

## Client

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  credentials: 'include',
  features: { chatAttachments: false, conversation: false },
});
```

| Option | |
| --- | --- |
| `baseUrl` | Wo die Routen des Protokolls liegen |
| `headers` | Ihre Auth-Header oder eine Funktion (für eine Token-Erneuerung auch asynchron), die pro Anfrage aufgerufen wird |
| `credentials` | Die `credentials` von `fetch` für Cookie-Authentifizierung |
| `features` | `false` schaltet ein Mitglied aus, auch `conversation` |

Der Provider liest den Event-Stream und lehnt mit `SdkError` ab (`ThrottledError` bei 429, `CollaborationConflict` bei einer verweigerten Operation). Da ein Stream nur in eine Richtung läuft, beendet er einen Durchlauf, dessen Operationen der Editor verweigert hat, durch Abbruch der Anfrage: Der Durchlauf lehnt mit dem Code dieser Operation und „The template changed while the AI was working.“ ab.

## Server

```ts
import {
  aiErrorResponse,
  aiEventStream,
  applyOperationsTool,
  buildChatRequest,
  checkRewrite,
  createEditingSession,
  editingInstructions,
  readAiRequest,
  runEditingTurn,
} from '@templatical/ai-kit/server';
```

| Export | |
| --- | --- |
| `editingInstructions` | Der System-Prompt zum Bearbeiten: die Regeln, die [Operationen](/de/api/operations) und das Template-Schema |
| `rewriteInstructions` | Die anderen Prompts |
| `buildEditingPrompt`, `buildChatRequest`, `buildFixRequest`, `buildRewritePrompt`, `buildAltTextRequest` | Prompts pro Anfrage |
| `applyOperationsTool` | Das einzige Tool: `apply_operations`, dessen `ops` ein JSON-String ist |
| `createEditingSession` | Die Arbeitskopie eines Durchlaufs: prüft jeden Aufruf (Form, die Grenze von 100 Operationen, keine neuen Custom-, Slot- oder Wrapper-Blöcke, deklarierte Merge-Tags, die Engine, eine Größenbegrenzung) und antwortet mit einem Satz, auf den das Modell reagieren kann |
| `runEditingTurn` | Die Referenzschleife über einen `AiModelAdapter`, höchstens drei Modellaufrufe |
| `aiEventStream` | Die Event-Stream-`Response` für jeden Fetch-API-Server |
| `aiErrorResponse`, `aiJsonResponse` | Fehler vor dem Stream und JSON-Antworten, mit dem Header des Protokolls |
| `readAiRequest` | Eine Anfrage des Protokolls, eingelesen und geprüft |
| `checkRewrite`, `buildRewriteRepairPrompt` | Prüfungen der Ausgabe |
| `checkAltTextAnswer`, `buildAltTextRepairRequest`, `checkAltText` | Alt-Text-Prüfung und eine Reparaturanfrage |

Das Kit enthält keine HTML-Bereinigung. Der Editor bereinigt die Vorschau einer Umformulierung und das mit „Replace“ übernommene HTML. HTML-Blöcke, die die KI schreibt, behalten ihr Markup unverändert; befolgen Sie die [Hinweise zur serverseitigen Bereinigung vor dem Speichern oder Versenden](/de/guide/blocks#html).

### Lint-Fixes

`AI_FIXABLE_RULES` aus `@templatical/editor` enthält genau die unten aufgeführten Regeln. `AI_ALT_TEXT_RULES` enthält genau `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` und `a11y.img-linked-no-context`. Beide Aktionen benötigen `@templatical/quality`, aktiviertes Lint und ein geladenes Template. Die kanonischen Kategorien, Kataloge und Optionen stehen unter [Barrierefreiheit](/de/quality/accessibility/), [Accessibility-Regelkatalog](/de/quality/accessibility/rule-catalog), [Zustellbarkeit](/de/quality/deliverability/), [Zustellbarkeits-Regelkatalog](/de/quality/deliverability/rule-catalog) und [Optionen](/de/quality/options).

`fixFinding` erhält die JSON-serialisierbare Lint-Projektion `finding: { ruleId, message, suggestion, reference, blockId, excerpt? }`; `severity`, `clients` und die lokale `fix`-Funktion gehören nicht dazu. Die Regeln und ihre Befunde sind unter [Qualität](/de/quality/) dokumentiert. Der Editor bietet Fixes für diese Regel-IDs an:

- `a11y.link-vague-text`
- `a11y.button-vague-label`
- `a11y.link-empty`
- `a11y.text-all-caps`
- `a11y.missing-preheader`
- `deliverability.link-text-domain-mismatch`
- `deliverability.low-text`

`buildFixRequest(finding)` füllt `prompts/fix.md` mit Diagnosedaten und der Anleitung aus `prompts/fix-rules.json`, exportiert als `FIX_RULE_GUIDANCE` aus `@templatical/ai-kit/server`. Unbekannte Regeln erhalten `Change only what the finding names.`. Alle Befundfelder sind Daten, keine Anweisungen; das Modell darf `reference` nicht abrufen. Bei Domain-Abweichungen bleibt das `href` unverändert, und bei zu wenig Text werden nur vorhandene Fakten als Text im E-Mail-Inhalt ergänzt.

`readAiRequest` lehnt ungültige Felder mit `SdkError` (Status 422, kein `code`) ab und kürzt nie: `ruleId` ist nicht leer und höchstens 200 Zeichen lang; `message`, `suggestion` und das optionale `excerpt` haben höchstens 1.000 Unicode-Codepoints; `reference` ist eine `http:`- oder `https:`-URL mit höchstens 2.048 Zeichen; `blockId` ist `null` oder eine Zeichenkette mit höchstens 200 Zeichen. Die Limits für IDs und URLs zählen UTF-16-Einheiten (`string.length`).

Prüfen Sie Ihren Fix-Endpunkt mit `runAiWireConformance({ baseUrl })` aus dem folgenden Beispiel; auch `runAiProviderConformance(provider)` sendet einen Lint-Befund an `fixFinding`.

### Alt-Text

`buildAltTextRequest(request: AiAltTextRequest)` liefert `{ system: string; messages: AiModelMessage[] }` mit dem Bild als `image-url`-Anhang der Nutzernachricht. `prompts/alt-text.md` verlangt den Zweck des Bildes in dieser E-Mail, Ziel oder Aktion verlinkter Bilder, sichtbaren Bildtext, die Sprache des Templates, Klartext und das `maxLength` der Anfrage. Umgebender Text und vorhandener Alt-Text sind Daten, keine Anweisungen.

`checkAltTextAnswer` prüft eine Antwort ohne Ausnahme und liefert `{ ok: true, alt }` oder `{ ok: false, reason }`. `checkAltText` ist die abschließende Prüfung und wirft bei einer ungültigen Antwort `SdkError(AI_ERROR_MESSAGES.ai_output_invalid, 502, "ai_output_invalid")`.

```ts
import type { AiModelMessage } from "@templatical/ai-kit/server";

export declare function checkAltTextAnswer(
  answer: string,
  { maxLength }: { maxLength: number },
): { ok: true; alt: string } | { ok: false; reason: string };

export declare function buildAltTextRepairRequest(
  built: { system: string; messages: AiModelMessage[] },
  answer: string,
  reason: string,
  maxLength: number,
): { system: string; messages: AiModelMessage[] };

export declare function checkAltText(
  answer: string,
  { maxLength }: { maxLength: number },
): string;
```

Die Normalisierung entfernt äußere Leerzeichen, ein umschließendes Paar einfacher oder doppelter Anführungszeichen und ein führendes „Image of“ oder „Picture of“ unabhängig von Groß-/Kleinschreibung, dann erneut äußere Leerzeichen. Nach dem Entfernen äußerer Leerzeichen sind Zeilenumbrüche unzulässig, auch wenn der Text kurz ist oder die Präfix-Normalisierung den Umbruch entfernen würde. Die Länge der normalisierten Zeichenkette zählt UTF-16-Einheiten (`alt.length`). Die Prüfung liefert den ersten zutreffenden Grund in dieser Reihenfolge:

| Bedingung | `reason` (unverändert) |
| --- | --- |
| Nach der Normalisierung leer | `Your answer was empty.` |
| Enthält einen Zeilenumbruch (CR, LF, U+2028 oder U+2029) | `Your answer had several lines.` |
| Enthält HTML (`/<[a-z]/i`) | `Your answer contained HTML.` |
| Länger als `maxLength` | `` `Your answer was ${alt.length} characters; the limit is ${maxLength}.` `` |

`buildAltTextRepairRequest(built, answer, reason, maxLength)` übernimmt denselben System-Prompt und die ursprünglichen Nachrichten einschließlich des Bildanhangs. Danach folgen `{ role: "assistant", content: answer }` und eine Nutzernachricht mit dem Inhalt `` `${reason} Reply again with only the alt text: one line of plain text, at most ${maxLength} characters.` ``. Übergeben Sie `maxLength` aus der ursprünglichen Anfrage als vierten Parameter. Die Funktion verändert `built` nicht und ruft kein Modell auf.

Der Server im Leitfaden und `evalAltTextWith` prüfen die erste Antwort mit `checkAltTextAnswer`. Bei Ablehnung senden sie genau eine Reparaturanfrage mit `buildAltTextRepairRequest` und prüfen danach mit `checkAltText`. Eine zweite ungültige Antwort löst `ai_output_invalid` aus; es gibt keinen dritten Modellaufruf. Prüfen Sie Ihren Endpunkt mit `runAiWireConformance({ baseUrl })` aus dem folgenden Beispiel.

`readAiRequest` validiert die Route `altText` ohne Kürzung: `blockId` ist nicht leer und höchstens 200 Zeichen lang; `image.url` ist eine mit `new URL()` geparste `http:`- oder `https:`-URL mit höchstens 2.048 Zeichen; `currentAlt` und `linkHref` sind Zeichenketten mit höchstens 2.048 Zeichen oder `null`; `nearbyText` hat höchstens 2.000 Codepoints; `locale` hat höchstens 35 Zeichen und entspricht `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/`; `maxLength` ist eine Ganzzahl von 1 bis 1.000. Ungültige Felder lösen `SdkError(message, 422)` ohne Code aus. Alle Zeichenlimits außer `nearbyText` zählen UTF-16-Einheiten.

Der Editor liefert seinen wirksamen Lint-Wert `altMaxLength`, Standard 125. Prüfen Sie die Antwort immer mit dem Anfragewert. Der Modellanbieter ruft `image.url` ab; Ihr Backend autorisiert Template und Block und löst private oder signierte Medien auf. [Alt-Text im Editor](/de/backend/ai#alt-text) beschreibt die Prüfung und das Flag `decorative`.

Die Union der Modellanhänge lautet:

```ts
export type AiModelAttachment =
  | { kind: "image" | "pdf"; mediaType: string; data: Blob }
  | { kind: "image-url"; url: string };
```

### Modell-Adapter

`runEditingTurn` ruft Ihr Modell über eine Methode auf:

<<< @/snippets/model-contract.ts

[Eigenes KI-Backend anbinden](/de/guide/bring-your-own-ai#modell-adapter) enthält Adapter für das Vercel AI SDK, OpenAI und Anthropic. Alle Beispiele unterstützen Chat, Fix, Umformulieren und Alt-Text sowie Bild-URLs für Alt-Text. Nur das Anthropic-Beispiel akzeptiert Bild- und PDF-Blobs im Chat. Die Client-Konfigurationen für OpenAI und Vercel setzen `chatAttachments: false` und schalten den gespeicherten Gesprächsverlauf aus.

### Chat-Anhänge

`AiChatRequest.attachments` ist immer vorhanden: `[]` ohne Dateien, sonst `{ file: Blob, kind: "image" | "pdf", name: string }[]`. `AiProvider.chatAttachments: false | true` ist ein Flag: `true` bedeutet, dass die `chat`-Funktion Anhänge akzeptiert; bei `chat: false` hat es keine Wirkung. Der HTTP-Provider aktiviert es standardmäßig bei aktivem Chat; `features: { chatAttachments: false }` deaktiviert es.

Ohne Anhänge bleibt der JSON-Body unverändert. Mit Anhängen benennt `AI_GENERATE_FIELDS` die Felder `message`, `selectedBlockId`, `mergeTags`, `content`, `revision` und wiederholte `attachment`-Dateiteile. `message` und `selectedBlockId` sind Text; `mergeTags` und `content` sind JSON-Strings; `revision` ist eine Zahl als Text. Fehlende `selectedBlockId` und `revision` werden `null`. Multipart ohne Dateiteile ist gültig. JSON-Bodys ergeben immer `attachments: []`.

`readAiRequest` akzeptiert die MIME-Typen `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`. Es lehnt ohne Kürzung mit Status 422 und ohne Code in dieser Reihenfolge ab:

| Bedingung | Nachricht |
| --- | --- |
| Formular nicht lesbar | Send the message as multipart form data. |
| Mehr als 4 Dateien | Attach at most 4 files. |
| Kein Dateiteil oder nicht unterstützter MIME-Typ | Attach PNG, JPEG, WebP or GIF images, or PDFs. |
| Eine Datei über `5 * 1024 * 1024` Byte | Each attachment must be 5 MB or smaller. |
| Zusammen über `10 * 1024 * 1024` Byte | Attachments must be 10 MB or smaller together. |
| Dateiname über 255 UTF-16-Einheiten | An attachment's file name must be at most 255 characters. |

`buildChatRequest(message: string, options?: { hasAttachments?: boolean })` lässt die reine Textanfrage standardmäßig unverändert; mit `hasAttachments: true` hängt es eine Leerzeile und `prompts/chat-attachments.md` an. Übergeben Sie die eingelesenen Dateien als Modellanhänge `{ kind, mediaType: file.type, data: file }`, wie im Leitfaden. Der Prompt nutzt Referenzen für die angeforderte Änderung und ersetzt das ganze Template nur bei leerem Inhalt oder ausdrücklicher Aufforderung; Bilder werden Platzhalter.

Die Konformitätssuiten senden bei aktiven Chat-Anhängen ein 1×1-PNG; die Protokollsuite erwartet außerdem 422 bei fünf Anhängen. Der Verlauf speichert nur `{ name, kind }` im optionalen `attachments` der Benutzernachricht; die Dateiaufbewahrung bestimmt das Backend.

## Testen

Beide Signaturen, alle Optionen und das gemeinsame Ergebnis:

<<< @/snippets/conformance-contract.ts

Die Provider-Prüfung verwendet die aktivierten Provider-Funktionen. `headers` und `features` gehören zur Wire-Prüfung; fehlende Flags aktivieren alle Funktionen. Standardwerte: `templateId: "conformance"`, `content: AI_EVAL_TEMPLATES.welcome`, `mergeTags: AI_EVAL_MERGE_TAGS`, `timeoutMs: 5000` ms. `callTimeoutMs` kann `timeoutMs` nicht überschreiten.

`altTextImageUrl` verwendet standardmäßig `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL` aus `@templatical/ai-kit/testing`: `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/images/probe.png` (`version` ist die installierte Kit-Version). Das Bild zeigt eine petrolfarbene Tasse ohne Text. Übergeben Sie bei unveröffentlichten Builds mit `altTextImageUrl` ein öffentliches Bild, das Ihr Modellanbieter abrufen kann.

Für Node.js 24 speichern Sie das folgende Beispiel als `check-ai-backend.ts`. Ihr authentifizierter `POST /api/templates` nimmt `{ name, content }` an und gibt `{ id }` zurück. Setzen Sie `AI_TEST_TOKEN`; `AI_BASE_URL` und `AI_TEMPLATES_URL` überschreiben die lokalen URLs. Führen Sie `node check-ai-backend.ts` aus. Das Beispiel erzeugt eine Wegwerf-Vorlage und deaktiviert Verlauf und Chat-Anhänge passend zum zustandslosen Server im [Backend-Leitfaden](/de/guide/bring-your-own-ai#der-server).

<<< @/snippets/check-ai-backend.ts

Das Beispiel fügt das Standardprüfbild als `blockId: "conformance-image"` ein, damit das Backend es autorisieren kann. Halten Sie diese Wegwerf-Vorlage während beider Suiten verfügbar.

Beide Suiten rufen aktivierte Modellfunktionen auf und verbrauchen dabei Tokens. Turn- und Fix-Prüfungen können angewendete Batches persistieren. Mit Verlauf prüfen sie `list`, Undo/Redo und `settleReplay` und leeren ihn über `clear`, sofern verfügbar. Die Wire-Suite sendet außerdem ungültige Anfragen, darunter mehr als vier Anhänge bei aktiven Chat-Anhängen. Verwenden Sie kein produktives Template. Entfernen Sie die Testvorlage anschließend über Ihren Speicher. Jede fehlgeschlagene Prüfung wird mit Name und Detail ausgegeben; Fehler setzen den Exit-Code auf 1.

- `createMockAiProvider(script)` spielt aufgezeichnete Streams für Ihre Oberflächentests ab; `AI_RECORDINGS` enthält die des Playgrounds.
- `runAiEvalSet({ runTurn, runAltText?, lintCheck?, loadFile?, model, cases?, minPassRate? })` führt `AI_EVAL_CASES` aus. `cases` ersetzt den Testsatz; `minPassRate` ist standardmäßig 90.
- `evalTurnWith(model, options?: { maxSteps?: number })` erstellt `runTurn`. Bei gesetztem `finding` verwendet es `buildFixRequest(finding)`, sonst `buildChatRequest(message, { hasAttachments })` und die Blob-Anhänge.
- `evalAltTextWith(model, options?: { imageUrl?: (file: string) => string })` erstellt `runAltText: (input: AiEvalAltTextInput) => Promise<string>`. Es verwendet `buildAltTextRequest`, `locale: "en"` und `checkAltText(text, { maxLength })`. Eine ungültige erste Antwort erhält genau einen Reparaturversuch vor der abschließenden Prüfung mit `checkAltText`.

Ein fehlendes `kind` bedeutet `edit`. Dateipfade sind relativ zu `eval/`. Die exportierten Typen und ihre Hilfstypen lauten:

```ts
import type { AiChatAttachment, AiFixFinding, AiMergeTags, TemplateContent } from "@templatical/types";

export type AiEvalCheck =
  | { type: "applied" | "notApplied" }
  | { type: "present" | "missing"; block: string }
  | { type: "contains" | "notContains"; block?: string; text: string }
  | { type: "lintGone"; ruleId: string }
  | { type: "field" | "fieldNot"; block: string; path: string; matches: string }
  | { type: "setting"; path: string; matches: string }
  | { type: "greater"; block: string; path: string; than: number }
  | { type: "maxText"; block: string; chars: number }
  | { type: "countType"; blockType: string; min: number }
  | { type: "order"; first: string; then: string }
  | { type: "firstContains"; text: string }
  | { type: "reply"; matches: string };

export type AiEvalAltCheck =
  | { type: "nonEmpty" | "withinLimit" }
  | { type: "containsAll" | "containsAny"; texts: string[] }
  | { type: "notMatches"; matches: string }
  | { type: "shortOrMatches"; chars: number; matches: string };

type EvalTemplate =
  "welcome" | "promo" | "injection" | "empty" | "domain-mismatch" | "low-text";

interface EvalTurnCase {
  name: string;
  template: EvalTemplate;
  /** Block ids the case may delete; every other original id must survive. */
  removed?: string[];
  checks: AiEvalCheck[];
}

export interface AiEvalAltTextInput {
  /** Path relative to the package's eval/ folder. */
  image: string;
  linkHref: string | null;
  nearbyText: string;
  maxLength: number;
}

export type AiEvalCase =
  | (EvalTurnCase & {
      kind?: "edit";
      message: string;
      selectedBlockId?: string;
      attachments?: { file: string; kind: "image" | "pdf" }[];
    })
  | (EvalTurnCase & { kind: "fix"; finding: AiFixFinding })
  | (AiEvalAltTextInput & {
      kind: "altText";
      name: string;
      checks: AiEvalAltCheck[];
    });

export interface AiEvalTurnInput {
  content: TemplateContent;
  mergeTags: AiMergeTags;
  message: string;
  selectedBlockId: string | null;
  finding: AiFixFinding | null;
  attachments: AiChatAttachment[];
}

export interface AiEvalTurnOutput {
  /** The template after the turn. */
  content: TemplateContent;
  reply: string;
  /** Whether the turn changed the template. */
  applied: boolean;
}

export interface AiEvalReport {
  model: string;
  passed: number;
  /** Cases that ran; skipped cases are excluded. */
  total: number;
  skipped: number;
  /** Whole percent, rounded down. */
  rate: number;
  ok: boolean;
  results: {
    name: string;
    ok: boolean;
    reason: string | null;
    skipped?: true;
  }[];
}
```

`lintCheck?: (content: TemplateContent) => string[]` liefert Regel-IDs nach dem Durchlauf. Die Prüfung `{ type: "lintGone"; ruleId: string }` erwartet, dass die ID fehlt. `{ type: "fieldNot"; block: string; path: string; matches: string }` negiert `field`; der Block muss existieren. Der Domain-Fall prüft den unveränderten `href` und sichtbaren Text ohne `www.` oder `://`.

Textvergleiche in `AiEvalAltCheck` ignorieren Groß- und Kleinschreibung. Längen verwenden `string.length`; `withinLimit` prüft das `maxLength` des Falls.

Ohne `runAltText` werden Alt-Text-Fälle übersprungen; ohne `lintCheck` werden Fälle mit `lintGone` übersprungen. `AiEvalReport.skipped` zählt sie, und ihr Ergebnis hat `skipped?: true`. `passed`, `total` und `rate` schließen sie aus. `rate` ist abgerundet und bei keinem ausgeführten Fall 0. Ein geworfener Fehler lässt einen ausgeführten Fall fehlschlagen.

`loadFile?: (file: string) => Promise<Blob>` lädt Anhänge. Standardmäßig ruft es `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}` ab. `evalAltTextWith` verwendet dieselbe URL für Bilder und liest `version` beim Build aus dem Paket. Für unveröffentlichte Builds setzen Sie `imageUrl`; für lokale Node-Läufe liest `loadFile` das installierte `eval/`-Verzeichnis. Das [vollständige Node-Beispiel](/de/guide/bring-your-own-ai#backend-konformitat-und-modellevaluierung) verbindet beide Runner mit `@templatical/quality` und Dateizugriff.

Die [Konformitätsprüfungen](#testen) prüfen nicht leeren Alt-Text innerhalb von `maxLength`, Abbruchverhalten und `altText: false`.

## Dateien

`@templatical/ai-kit/prompts/*.md`, `@templatical/ai-kit/prompts/*.json`, `@templatical/ai-kit/schema/*.json` und `@templatical/ai-kit/eval/*` (mit `MANIFEST.sha256`) sind Prompts, Schemas und Testsatz als Dateien für ein Backend in einer anderen Sprache. Der System-Prompt zum Bearbeiten besteht aus `editing.md`, dann `"\n\n# Operations\n\n"` und `operations.md`, dann `"\n\n# Template content schema\n\n"` und `template-content.schema.json`.

## Das Protokoll

Jede Anfrage und Antwort enthält `Templatical-AI-Wire: 1`; Durchläufe, Alt-Text, Rückgängig, Wiederholen und deren Bestätigung enthalten `X-Templatical-Session`. Ein Cross-Origin-Backend erlaubt beim Preflight `Templatical-AI-Wire`, `X-Templatical-Session` und den Authentifizierungs-Header in `Access-Control-Allow-Headers` und gibt `Templatical-AI-Wire` über `Access-Control-Expose-Headers` frei. Die Routen sind relativ zu Ihrer Basis-URL; `{t}` ist die Template-ID.

| Route | Request | Response |
| --- | --- | --- |
| `POST /templates/{t}/ai/generate` | JSON `{ message, selectedBlockId, mergeTags, content, revision }`, oder Multipart mit wiederholten `attachment`-Dateiteilen | SSE |
| `POST /templates/{t}/ai/fix-finding` | JSON `{ finding, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/rewrite-text` | JSON `{ html, preset, language, instruction, mergeTags }` | SSE: `text`*, `done { html }` |
| `POST /templates/{t}/ai/alt-text` | JSON `{ blockId, image: { url }, currentAlt, linkHref, nearbyText, locale, maxLength }` | SSE: `done { alt }` |
| `GET /templates/{t}/ai/conversation-messages` | — | JSON `{ data: AiChatMessage[] }` |
| `POST /templates/{t}/ai/messages/{m}/undo`, `…/redo` | — | JSON `{ data: { operations, replayId } }` or `{ data: { batchId, revision } }` |
| `POST /templates/{t}/ai/messages/{m}/replays/{replayId}` | JSON `{ direction, applied }`, `X-Templatical-Session` | 204 |
| `DELETE /templates/{t}/ai/conversation` | — | 204 |

**Events** sind `data: {json}`-Zeilen mit jeweils einem `type`; `: ping`-Kommentare halten die Verbindung offen. `text { text }`; `operations { ops }` (der Editor wendet sie an); `applied { batchId, revision, operationCount }`; `done { messageId }` (Durchläufe: String oder `null` ohne Verlauf), `done { html }` (Umformulieren), `done { alt }` (Alt-Text); `error { code, message }`. `done` oder `error` ist das letzte Event.

**Fehler vor dem Stream** sind JSON `{ message, code, …details }` mit dem Status des Codes: `feature_unavailable` und `limit_reached` 403, `rate_limited` 429 mit `Retry-After`, `ai_turn_running` 409, `content_too_large` 413, `ai_output_invalid` 422, `ai_provider_error` 502, `not_found` 404, ein Operationscode 409 (`invalid_operation` 422). Ein Validierungsfehler ist ein 422 `{ message }`.

Die `batches` einer Nachricht sind `{ batchId, revision, operationCount }`; ein Batch, den der Editor selbst angewendet hat, hat keine Backend-Revision. Speichern Sie dafür `revision: null`.


`AI_LIMITS.contentMaxBytes` begrenzt den JSON-serialisierten Template-Inhalt auf 200.000 UTF-8-Bytes; `readAiRequest` lehnt größere Inhalte mit `content_too_large` (413) ab. `selectedBlockId` und die Sitzungs-ID sind auf 200 Zeichen begrenzt. Diese Zeichenlimits zählen Unicode-Codepunkte; die Feldlimits für Lint-Befunde stehen unter [Lint-Fixes](#lint-fixes).
