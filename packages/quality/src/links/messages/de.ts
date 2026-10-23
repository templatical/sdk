import type en from "./en";

const de: typeof en = {
  "link.javascript-protocol": {
    message:
      'Die URL verwendet das Protokoll „{protocol}:", das beliebigen Skriptcode ausführen kann und aus Sicherheitsgründen beim Rendern entfernt wird.',
    suggestion: "Ersetze sie durch eine echte URL oder entferne sie.",
  },
  "link.unsupported-protocol": {
    message:
      'Die URL verwendet das Protokoll „{protocol}", das von den meisten E-Mail-Clients nicht unterstützt wird.',
    suggestion: "Verwende http, https, mailto, tel oder sms.",
  },
  "link.malformed-mailto": {
    message: "mailto:-Link ist fehlerhaft.",
    suggestion:
      "Setze eine einzelne Empfängeradresse vor die Abfragezeichenfolge (z. B. mailto:hello@example.com).",
  },
  "link.malformed-tel": {
    message:
      "tel:-Link enthält andere Zeichen als Ziffern, +, Leerzeichen, Bindestriche, Klammern oder Punkte.",
    suggestion:
      "Verwende in der Telefonnummer nur Ziffern, +, Leerzeichen, Bindestriche, Klammern oder Punkte.",
  },
  "link.localhost-or-staging": {
    message: 'Der URL-Host „{host}" entspricht einem Nicht-Produktionsmuster.',
    suggestion: "Ersetze ihn vor dem Versand durch die Produktions-URL.",
  },
  "link.relative-url": {
    message:
      'Die URL „{url}" ist relativ. Eine versendete E-Mail hat keine Seitenadresse, gegen die sie aufgelöst werden kann, daher funktioniert der Link nicht.',
    suggestion: "Verwende eine absolute URL (https://…).",
  },
};

export default de;
