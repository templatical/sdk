---
title: Test-E-Mails
description: Wie Templatical Cloud Test-E-Mails versendet — und wie Sie sie stattdessen über Ihre eigene Infrastruktur senden.
---

# Test-E-Mails

Senden Sie Test-E-Mails direkt aus dem Editor, um die Darstellung in einem echten Postfach vor dem Go-Live zu prüfen.

Test-E-Mail ist eine **gemeinsame Funktion**: Auslöser, Dialog, Empfängerprüfung und alle Versandzustände sind im OSS- und im Cloud-Editor dieselben Komponenten. Nur der Versand unterscheidet sich. Der [Leitfaden Test-E-Mails](/de/guide/test-email) behandelt die Funktion selbst — diese Seite beschreibt, was Cloud ergänzt und wie Sie es überschreiben.

## Wie Cloud versendet

1. Der Nutzer klickt im Editor-Header auf **Test**.
2. Er wählt einen Empfänger aus der Liste des Projekts.
3. Die Vorlage wird gespeichert und dann **serverseitig** zu HTML gerendert.
4. Cloud stellt die E-Mail zu.

Drei Bedingungen steuern die Schaltfläche, und keine folgt aus einer anderen — alle müssen erfüllt sein, damit sie erscheint:

- das Plan-Feature `test_email`;
- eine Test-E-Mail-Konfiguration im Auth-Token des Projekts (die erlaubten Empfänger samt Signatur);
- eine **gespeicherte** Vorlage, da Cloud aus der gespeicherten Fassung rendert.

### Die Liste der erlaubten Empfänger ist signiert

Die Liste kommt mit dem Auth-Token und wird mit einer Signatur zurückgesendet, die das Backend prüft. Das ist wesentlich, weil das SDK im Browser des Nutzers läuft: ohne eine serverseitig signierte Liste wäre der Endpunkt ein offenes Relay.

Das ist der einzige Punkt, an dem sich Cloud und ein eigener Versand wirklich unterscheiden. Ein von Ihnen bereitgestellter Provider trägt ein `allowedRecipients`-Array, das **nicht signiert** ist — es schränkt die Auswahl ein, und Ihr eigenes Backend muss es durchsetzen. Siehe [Empfänger einschränken](/de/guide/test-email#empfanger-einschranken).

## Before-Send-Hook

Transformieren Sie das gerenderte HTML unmittelbar vor dem Versand durch Cloud — nützlich für Preheader-Text oder das Füllen von Merge-Tags mit Testdaten:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onBeforeTestEmail: async (html) => {
    return html
      .replace('{{first_name}}', 'Jane')
      .replace('{{company}}', 'Acme Corp');
  },
});
```

Cloud-exklusiv, und das mit Absicht: Der Hook existiert, weil *Cloud* das HTML rendert und Sie daher einen Zugriffspunkt brauchen. Stellen Sie einen eigenen Versand bereit (siehe unten), **ist** dieser Provider der Zugriffspunkt — der Hook wird darauf nicht angewendet.

## Selbst versenden

`initCloud()` akzeptiert denselben `testEmail`-Schlüssel wie `init()`. Sie können Cloud also für alles Übrige behalten und E-Mails dennoch über Ihre eigene Infrastruktur versenden — meist aus Compliance- oder Datenresidenz-Gründen:

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  testEmail: {
    send: async ({ recipient, content }) => {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, content }),
      });
      if (!res.ok) throw new Error('Test-E-Mail konnte nicht gesendet werden');
    },
  },
});
```

Lassen Sie den Schlüssel weg, versendet Cloud. Geben Sie ihn an, versendet Ihre Implementierung — und zwar **ohne Plan-Bindung**, denn das Feature `test_email` lizenziert den Versand durch Cloud, nicht die Oberfläche des Editors. Ihre Nutzer merken in beiden Fällen keinen Unterschied.

Da Schlüssel und Typ auf beiden Einstiegspunkten identisch sind, bedeutet der Wechsel einer OSS-Integration zu Cloud: diesen Schlüssel löschen oder unverändert lassen — nie umschreiben.

## Composables

Die Test-E-Mail-Konfiguration von Cloud und ihr Versand sind getrennt, damit ein einziger Versandpfad beide Editoren bedient:

```js
import { useTestEmail, createCloudTestEmailProvider } from '@templatical/core/cloud';

// Konfiguration: was dieses Projekt darf.
const {
  isEnabled,      // ComputedRef<boolean> — das Token enthält eine Test-E-Mail-Konfiguration
  allowedEmails,  // ComputedRef<string[]> — erlaubte Empfänger
  getSignature,   // () => string | null — erlaubt dem Backend, diese Liste zu prüfen
} = useTestEmail({ authManager, isAuthReady });

// Versand: ein `TestEmailProvider`, austauschbar mit Ihrem eigenen.
const provider = createCloudTestEmailProvider({
  authManager,
  getTemplateId: () => templateId,
  save: () => editor.save(),
  exportHtml: (id) => exportFn(id),
  allowedEmails,
  getSignature,
  onBeforeTestEmail: (html) => html,
});
```

::: warning `allowedEmails` wird asynchron gefüllt
Die Liste kommt mit dem Auth-Token und ist daher leer, bis die Authentifizierung abgeschlossen ist. **Lesen Sie sie reaktiv** — ein bei der Initialisierung erfasster Wert bleibt für die gesamte Sitzung leer, und da eine leere Liste „niemand darf angeschrieben werden" bedeutet, würde die Schaltfläche nie erscheinen.
:::
