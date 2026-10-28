---
title: Übersetzung
description: Verbinden Sie init({ translation }) mit einem TranslationProvider für maskierte Felder oder bedienen Sie POST /templates/{template}/translate mit dem KI-Kit und prüfen Sie mit runTranslationConformance.
---

# Übersetzung

Verbinden Sie `init({ translation })` mit einem `TranslationProvider`, um geeignete Felder aus der Standardsprache in eine aktivierte Sprachversion zu übersetzen.

## Editor-Einrichtung

Mounten Sie in einer Vite-App mit `@templatical/editor` und `@templatical/ai-kit` den Editor in einem vorhandenen `#editor`-Container mit bestimmter Höhe:

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import { createHttpTranslationProvider } from "@templatical/ai-kit/client";

const editor = await init({
  container: "#editor",
  localization: { locales: ["en", "de"] },
  translation: createHttpTranslationProvider({ url: "/api" }),
});
```

Fügen Sie unter **Sprachen** Deutsch hinzu und wählen Sie es aus. Übersetzen erscheint nur mit `translation`, konfigurierter `localization` und einer aktivierten Nicht-Standardsprachansicht. Weder `AiProvider` noch ein geladenes Template sind nötig; ohne Template ist `templateId` gleich `null`. Ohne `translation` fehlt die Übersetzungsoberfläche. `initCloud()` ignoriert `translation` mit einer Warnung. [Lokalisierte Templates](/de/guide/localized-templates#translating) beschreibt die Aktionen und den JSON-Strings-Rundlauf.

## Provider-Vertrag

`TranslationProvider.translate(request, signal)` liefert ein `TranslationResult`. Die vollständigen Deklarationen einschließlich der reinen Strings-Helfer:

<<< @/snippets/translation-contract.ts

`TranslationRequest.fields` enthält 1–50 Felder mit zusammen höchstens 20,000 UTF-16-Einheiten (`text.length`). IDs sind `<blockId>/<path>` oder `settings/<path>`. `sourceLocale` ist die Standardsprache, `targetLocale` die gewählte Version. `templateId` ist die ID des geladenen Templates oder `null`. Das Kit prüft eindeutige, nichtleere IDs und Sprach-Tags. Ergebnisse dürfen unvollständig sein; ausgelassene Felder behalten ihren bisherigen Wert, unbekannte IDs ignoriert der Editor.

Nur `content` von Titel und Absatz verwendet `format: "html"`; alle anderen geeigneten Felder verwenden `"text"`. HTML-Blöcke sind vom Übersetzen ausgeschlossen und bleiben von Hand bearbeitbar. Leere Standardwerte, `set`-Überschreibungen und ausgeblendete Blöcke werden ebenfalls ausgelassen.

Der Editor maskiert ganze Merge-/Logik-Chips in HTML und durch die aktive Syntax erkannte rohe Tags in beiden Formaten. Textinhalt verwendet `<x id="n"/>`, HTML-Attributwerte `__xn__`; beide teilen eine ID-Folge ab 1 in Quellreihenfolge pro Feld. Geben Sie jede ID genau einmal in einem der akzeptierten Formate zurück; `<x id="n"></x>` wird ebenfalls akzeptiert. Platzhalter dürfen ihre Position ändern. Fehlende, doppelte oder zusätzliche IDs erhalten den alten Wert und melden `tags_changed`. Vorhandene Übersetzungen werden mit den Quell-Token-IDs maskiert; geänderte Tags schließen das Feld aus. Zurückgegebenes HTML durchläuft Rewrites `sanitizeRichTextHtml`-Erlaubnisliste mit geschützten Tokens; anschließend werden die ursprünglichen Tags bytegetreu wiederhergestellt. Die reinen Helfer bereinigen HTML nicht; Headless-Aufrufer übernehmen diesen Schritt.

Aufrufe laufen nacheinander. Bei `content_too_large` halbiert der Editor den Batch und versucht es erneut bis zu einem Feld; ein einzelnes Feld über der Grenze wird nicht gesendet. Vor Abbrechen oder einem Provider-Fehler erhaltene gültige Felder werden gemeinsam als ein Rückgängig-Schritt angewendet. Ein Durchlauf ohne Änderung zeichnet nichts auf. Mit Zusammenarbeit ist dies eine gewöhnliche Bearbeitung; von anderen Sitzungen in der erfassten Zielsprache oder strukturell gesperrte Blöcke werden ausgelassen und gemeldet.

| `code` | Wire-Status | Bedeutung |
| --- | --- | --- |
| `rate_limited` | 429 | Zu viele Anfragen |
| `limit_reached` | 403 | Das Kontingent des Providers ist erschöpft |
| `content_too_large` | 413 | Mit weniger Feldern erneut versuchen |
| `translation_failed` | 502 | Kein gültiges Übersetzungsergebnis |

Lehnen Sie mit verständlicher Nachricht und einem dieser String-`code`-Werte ab, etwa `new SdkError("Translation is unavailable.", 502, "translation_failed")` aus `@templatical/types`. Der Editor erkennt Codes über Bundle-Grenzen hinweg, auch beim eigenen `SdkError` eines Integrators; dieselbe Klasseninstanz ist nicht nötig. Ein Abbruch lehnt mit `AbortError` ab. Der editorlokale Code `translation_running` lehnt einen zweiten parallelen Durchlauf ab; er ist kein `TranslationErrorCode` und kein Wire-Routenfehler. Ungültige Kit-Anfragen ergeben 422 `{ message }` ohne Code.

## HTTP-Protokoll

`createHttpTranslationProvider({ url, headers?, fetch? })` verwendet eine Basis-`url`, optional `headers: () => Record<string, string> | Promise<Record<string, string>>` und optional `fetch: typeof fetch`. Dienstschlüssel bleiben im Backend; `headers` dient der Authentifizierung Ihrer Anwendung.

Der Routenname ist `translate`: `POST /templates/{template}/translate`, relativ zu `url`. Bei `templateId: null` ist `{template}` gleich `_`. Der JSON-Body ist die vollständige `TranslationRequest`; 200 liefert `TranslationResult` als JSON. Anfragen und Antworten tragen `Templatical-AI-Wire: 1`; diese Route verwendet kein SSE und benötigt keinen Sitzungsheader. Fehler verwenden `{ message, code, ...details }` mit dem obigen Status. Cross-Origin-Server erlauben `Templatical-AI-Wire`, `Content-Type` und ihren Auth-Header und exponieren `Templatical-AI-Wire`.

## Server-Implementierung

Dieser Fetch-API-Handler benötigt `@templatical/ai-kit`. Authentifizieren und autorisieren Sie vor dem Aufruf sowohl das Pfad-Template als auch `templateId` im Body; autorisieren Sie auch Anfragen ohne Template. Übergeben Sie einen `AiModelAdapter`, etwa einen Adapter aus [dem KI-Kit](/de/api/ai-kit), mit Ihren serverseitigen Modell-Zugangsdaten:

<<< @/snippets/translate-server.ts

`readTranslationRequest(request)` prüft JSON-Body und Aufrufgrenzen; auch `readAiRequest` erkennt die Route `translate`. `translateFields({ request, model, signal? })` sammelt Text aus `model.stream` mit `tools: []`. Es prüft jede angeforderte ID genau einmal und deren Platzhalter-Multimenge, versucht fehlgeschlagene Felder einmal zu reparieren und liefert gültige Felder in Anfragereihenfolge. Abgeschnittene Antworten, Verweigerungen und ungültiges JSON werden einmal repariert; besteht kein Feld die Prüfung, folgt `translation_failed`. `AbortError` wird unverändert weitergegeben. Das Kit bereinigt zurückgegebenes HTML nicht.

## Mock und Konformität

`createMockTranslationProvider({ translations?, delayMs? })` aus `@templatical/ai-kit/testing` akzeptiert `translations?: Record<string, Record<string, string>>`, nach Zielsprache und Feld-ID indiziert, und `delayMs?: number`. Ohne hinterlegte Übersetzung wird `[<targetLocale>] ` vorangestellt, bei HTML im ersten sichtbaren Textsegment; Platzhalter bleiben erhalten. Abbrüche werden berücksichtigt.

## Prüfen {#check-it}

Führen Sie dies in Node.js mit installiertem `@templatical/ai-kit` zunächst gegen den Mock aus und ersetzen Sie ihn anschließend durch Ihren authentifizierten HTTP-Provider:

```ts
import { createMockTranslationProvider, runTranslationConformance } from "@templatical/ai-kit/testing";

const checks = await runTranslationConformance(createMockTranslationProvider(), { locale: "de" });
for (const check of checks) {
  if (!check.ok) throw new Error(`${check.name}: ${check.detail ?? "failed"}`);
}
```

`runTranslationConformance(provider, options?: { locale?: string })` liefert `Promise<{ name: string; ok: boolean; detail?: string }[]>`; die Zielsprache ist standardmäßig `de`. Geprüft werden Platzhalter, HTML-Tagnamen (`p`, `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br`, `span`), Teilergebnisse, eine Anfrage mit 51 Feldern (mit `content_too_large` ablehnen oder vollständig übersetzen) und `AbortError`. Jeder Aufruf hat eine Frist von 5.000 ms. Die Node-Prüfung kontrolliert Tagnamen und ersetzt nicht den DOM-Sanitizer des Editors. Echte Provider können Tokens oder Kontingent verbrauchen.

Speichern Sie nach dem Übersetzen das Template und führen Sie `npx -y @templatical/template-tools validate template.json --locale de --json` aus. Prüfen Sie die Befunde: Für die übersetzten Felder dürfen weder `localization.untranslated`, `localization.stale` noch `localization.merge-tags-differ` auftreten. Fehlend-/Veraltet-Warnungen allein verursachen keinen Fehler-Exit. Siehe [Validierungsvertrag](/de/guide/localized-templates).
