import type en from "./en";

const de: typeof en = {
  "deliverability.link-text-domain-mismatch": {
    message:
      "Der Linktext zeigt {textHost}, der Link führt aber zu {linkHost}. Spamfilter werten solche Links als Phishing.",
    suggestion:
      "Lass den Text zum Ziel passen oder verwende Wörter statt einer Adresse.",
  },
  "deliverability.url-shortener": {
    message:
      "Dieser Link läuft über den URL-Kürzer {host}. Spamfilter behandeln gekürzte Links mit Misstrauen, weil sie das Ziel verbergen.",
    suggestion: "Verlinke direkt auf das Ziel.",
  },
  "deliverability.ip-address-url": {
    message:
      "Dieser Link führt zur IP-Adresse {host} statt zu einer Domain. Spamfilter werten solche Links als Spam.",
    suggestion: "Verlinke auf deine Domain.",
  },
  "deliverability.low-text": {
    message:
      "Diese E-Mail enthält Bilder, aber nur {count} Zeichen Text (weniger als {min}). Manche Spamfilter bewerten bildlastige E-Mails mit wenig Text negativ, und wer Bilder blockiert, sieht fast nichts.",
    suggestion: "Ergänze Text, der die Botschaft trägt.",
  },
};

export default de;
