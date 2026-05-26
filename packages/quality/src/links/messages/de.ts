import type en from "./en";

const de: typeof en = {
  "link.javascript-protocol":
    'Die URL verwendet das Protokoll „{protocol}:", das beliebigen Skriptcode ausführen kann und aus Sicherheitsgründen beim Rendern entfernt wird. Ersetze sie durch eine echte URL oder entferne sie.',
  "link.unsupported-protocol":
    'Die URL verwendet das Protokoll „{protocol}", das von den meisten E-Mail-Clients nicht unterstützt wird. Verwende http, https, mailto, tel oder sms.',
  "link.malformed-mailto":
    "Der mailto:-Link ist fehlerhaft. Erwartet wird eine einzelne Empfängeradresse vor einer eventuellen Querystring (z. B. mailto:hallo@example.com).",
  "link.malformed-tel":
    "Der tel:-Link enthält Zeichen, die keine Ziffern, +, Leerzeichen, Bindestriche, Klammern oder Punkte sind.",
  "link.localhost-or-staging":
    'Der URL-Host „{host}" entspricht einem Nicht-Produktionsmuster. Ersetze ihn vor dem Versand durch die Produktions-URL.',
};

export default de;
