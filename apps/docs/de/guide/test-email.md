---
title: Test-E-Mails
description: Lassen Sie Ihre Nutzer sich die Vorlage zusenden, die sie gerade bearbeiten — versendet über Ihre eigene Infrastruktur.
---

# Test-E-Mails

Lassen Sie Nutzer sich selbst die Vorlage zusenden, die sie gerade bearbeiten, damit sie sie in einem echten Postfach sehen, bevor sie in eine Kampagne geht.

Der Editor übernimmt den Auslöser, den Dialog, die Empfängerprüfung sowie alle Zustände für Versand, Erfolg und Fehler. **Der Versand liegt bei Ihnen.** Eine einzige Methode genügt.

::: tip Das haben Sie mit hoher Wahrscheinlichkeit bereits
Wenn Sie einen E-Mail-Editor einbetten, besteht bei Ihnen schon eine Pipeline für Transaktions-E-Mails — SES, Postmark, Resend, SendGrid oder eigenes SMTP. Diese Funktion nutzt sie, statt etwas Neues von Ihnen zu verlangen.
:::

## Schnellstart

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',
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

Das ist die vollständige Integration. Im Editor-Header erscheint eine Schaltfläche **Test**; ein Klick öffnet den Dialog, und die gewählte Adresse wird an Ihr `send` übergeben.

**Lassen Sie `testEmail` weg, und die Funktion ist vollständig abwesend** — keine Schaltfläche, und kein zugehöriger Code wird geladen.

## Die Nutzlast

```ts
interface TestEmailPayload {
  recipient: string;
  content: TemplateContent;      // immer vorhanden
  mjml?: string;                 // nur wenn `includeMjml` gesetzt ist
  allowedRecipients?: string[];  // nur wenn konfiguriert — nicht vertrauenswürdig, siehe unten
}
```

Lehnen Sie mit einer Meldung ab, und der Dialog zeigt sie direkt an und bleibt für einen erneuten Versuch geöffnet:

```ts
send: async ({ recipient, content }) => {
  const res = await fetch('/api/test-email', { /* … */ });
  if (res.status === 429) throw new Error('Zu viele Test-E-Mails — versuchen Sie es in einer Minute erneut.');
  if (!res.ok) throw new Error('Test-E-Mail konnte nicht gesendet werden.');
}
```

Die Meldung erreicht den Nutzer wortgleich — formulieren Sie sie also für ihn und geben Sie keinen Statuscode aus.

## Umwandlung in HTML

`content` ist die Vorlage als JSON. Ihr Mailversand benötigt HTML, kompilieren Sie es also serverseitig mit [`@templatical/renderer`](/de/api/renderer-typescript) und einem MJML-Compiler:

```ts
// Auf Ihrem Server
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

app.post('/api/test-email', async (req, res) => {
  const { recipient, content } = req.body;

  // Prüfen Sie den Empfänger hier — siehe „Empfänger einschränken" unten.
  const mjml = await renderToMjml(content);
  const { html } = mjml2html(mjml);

  await mailer.send({ to: recipient, subject: 'Test-E-Mail', html });
  res.sendStatus(204);
});
```

### Das MJML vom Editor erzeugen lassen

Wenn Sie `renderToMjml` nicht selbst aufrufen möchten, setzen Sie `includeMjml`, und die Nutzlast enthält es:

```ts
testEmail: {
  includeMjml: true,
  send: async ({ recipient, mjml }) => { /* `mjml` → HTML kompilieren und senden */ },
}
```

Dafür muss [`@templatical/renderer`](/de/api/renderer-typescript) installiert sein — ein optionales Peer-Paket. Zwei Verhaltensweisen sind wichtig:

- **Ist es nicht installiert**, findet der Versand dennoch statt, allerdings nur mit JSON: `mjml` fehlt, und der Editor protokolliert eine einmalige Warnung mit dem Paketnamen. Die Aktivierung unterbricht den Versand also nie — **prüfen Sie `mjml` daher stets auf `undefined`**.
- **Schlägt die Umwandlung fehl** — etwa bei einem fehlerhaften benutzerdefinierten Block — wird der Versand abgebrochen und der Fehler im Dialog angezeigt. Das ist beabsichtigt: ein stiller Versand ohne MJML würde eine defekte Vorlage verbergen.

Die Umwandlung von MJML in HTML übernehmen Sie in beiden Fällen selbst. Der Editor bündelt niemals einen MJML-Compiler.

## Empfänger einschränken

Standardmäßig akzeptiert der Dialog jede Adresse. Mit `allowedRecipients` schränken Sie ihn ein:

```ts
testEmail: {
  allowedRecipients: [currentUser.email, 'qa@acme.com'],
  send: async ({ recipient, content }) => { /* … */ },
}
```

| Wert | Der Dialog zeigt |
| --- | --- |
| weggelassen | ein Freitextfeld mit Formatprüfung |
| ein Eintrag | ein schreibgeschütztes, vorbelegtes Feld |
| mehrere | eine Auswahl genau dieser Adressen |
| `[]` (leer) | nichts — die Funktion meldet sich als nicht verfügbar, und **es erscheint keine Schaltfläche** |

Ein leeres Array wird als Entscheidung gelesen („niemand darf angeschrieben werden"), nicht als „nicht gesetzt". Mit `defaultRecipient` wählen Sie einen bestimmten Eintrag vor; er wird ignoriert, wenn er nicht auf der Liste steht.

::: danger Das ist keine Sicherheitsgrenze
`allowedRecipients` liegt im Browser des Nutzers und lässt sich dort trivial ändern. Die Angabe schränkt die *Auswahl* ein, nicht mehr.

**Prüfen Sie den Empfänger auf Ihrem Server**, und zwar jedes Mal. Ohne diese Prüfung ist Ihr Endpunkt ein offenes Relay: Wer ihn erreicht, kann beliebige Adressen von Ihrer Domain aus anschreiben.
:::

Die Nutzlast gibt die Liste als `allowedRecipients` zurück, damit eine `send`-Implementierung zwischen Ihrem Backend und Templatical Cloud portabel bleibt. Sie ist **nicht vertrauenswürdig** — ohne Signatur und aus dem Browser gelesen. Über die Portabilität hinaus ist sie für eines nützlich: den Vergleich mit `recipient` auf dem Server. Eine Abweichung bedeutet, dass der Client manipuliert wurde oder fehlerhaft ist — das lohnt sich zu protokollieren.

## Was Nutzer sehen

1. Eine Schaltfläche **Test** im Editor-Header.
2. Einen Dialog mit dem oben beschriebenen Empfängerfeld.
3. Eine Vorschau der Vorlage (siehe unten).
4. Senden → ein Ladeindikator, dann eine kurze Bestätigung, dann schließt sich der Dialog selbst.
5. Bei einem Fehler bleibt der Dialog geöffnet und zeigt Ihre Meldung direkt an.

## Die Vorschau

Der Dialog zeigt die Vorlage ohne Editor-Elemente in E-Mail-Breite, mit einem Umschalter für Desktop und Mobil — so bestätigen Nutzer den Inhalt, ohne den Dialog zu verlassen.

In zwei Punkten ist sie korrekt, die eine naive Vorschau falsch darstellen würde:

- **Anzeigebedingungen werden berücksichtigt.** Ein durch eine Bedingung ausgeschlossener Block fehlt, sodass die Vorschau niemals Inhalte zeigt, die der Empfänger nicht erhält.
- **Responsive Blöcke folgen dem Umschalter.** Vorlagen mit gerätespezifischen Blöcken zeigen die Variante, die ein Empfänger auf diesem Gerät erhält, statt immer die Desktop-Fassung.

Sie ist bewusst **keine** Vorschau der zugestellten E-Mail. Merge-Tags erscheinen unaufgelöst — Ihr Backend setzt sie ein —, und die eigentliche Nachricht ist kompiliertes HTML, das ein E-Mail-Client darstellt. Der Dialog weist unter dem Umschalter darauf hin. Verstehen Sie sie als „Ist das die richtige Vorlage?", nicht als „Sieht es im Postfach genau so aus?".

Die Vorschau liegt im ohnehin verzögert geladenen Chunk des Dialogs — wer `testEmail` nicht konfiguriert, lädt davon nichts.

## Wechsel zu Templatical Cloud

`initCloud()` akzeptiert denselben `testEmail`-Schlüssel — ein Upgrade erfordert also nie, ihn umzuschreiben:

- **Lassen Sie ihn weg**, und Templatical Cloud versendet, mit eigener Zustellinfrastruktur und einer serverseitig signierten Empfängerliste.
- **Lassen Sie ihn unverändert**, und Ihr Versand bleibt aktiv — das ist der Weg, wenn E-Mails aus Compliance- oder Datenresidenz-Gründen Ihre eigene Infrastruktur nicht verlassen dürfen.

Nach dem Wechsel auf den Cloud-Versand gibt es zwei Unterschiede:

- Cloud erzeugt das HTML serverseitig, `includeMjml` ist dort also ohne Bedeutung.
- Cloud setzt eine **gespeicherte** Vorlage voraus; bis dahin fehlt die Schaltfläche.

Ihre Nutzer merken in beiden Fällen keinen Unterschied — Schaltfläche, Dialog und Ablauf sind in beiden Editoren dieselben Komponenten.
