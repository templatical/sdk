/*! caniemail data © Rémi Parmentier, MIT — https://github.com/hteumeuleu/caniemail */
export const CANIEMAIL_SOURCE = {"url":"https://www.caniemail.com/api/data.json","apiVersion":"1.0.4","lastUpdateDate":"2026-09-16 13:05:00 +0000","sha256":"acf915ccb55f547d6e1f9d6f6df514af6910c8e3af85d0f263bee9dd9acf167a"} as const;
export const CANIEMAIL_DATA_DATE = "2026-09-16";
// prettier-ignore
export const CANIEMAIL_NICENAMES = {
  "family": {
    "gmail": "Gmail",
    "outlook": "Outlook"
  },
  "platform": {
    "webmail": "Webmail",
    "windows": "Windows"
  }
} as const;
// prettier-ignore
export const CANIEMAIL_DATA = {
  "css-display-flex": {
    "title": "display:flex",
    "url": "https://www.caniemail.com/features/css-display-flex/",
    "lastTestDate": "2026-09-01",
    "notes": {
      "2": "`display:inline-flex` is not supported."
    },
    "cells": {
      "gmail.webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2024-05"
      }
    }
  }
} as const;
