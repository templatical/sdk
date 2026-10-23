/*! caniemail data © Rémi Parmentier, MIT — https://github.com/hteumeuleu/caniemail */
export const CANIEMAIL_SOURCE = {
  url: "https://www.caniemail.com/api/data.json",
  apiVersion: "1.0.4",
  lastUpdateDate: "2026-09-16 13:05:00 +0000",
  sha256: "7328f873fae3bb24455d10bf3005464b2af12cbbcc5b54da51683d4911235628",
} as const;
export const CANIEMAIL_DATA_DATE = "2026-09-16";
// prettier-ignore
export const CANIEMAIL_NICENAMES = {
  "family": {
    "gmail": "Gmail",
    "outlook": "Outlook",
    "yahoo": "Yahoo! Mail",
    "apple-mail": "Apple Mail",
    "aol": "AOL",
    "thunderbird": "Mozilla Thunderbird",
    "microsoft": "Microsoft",
    "samsung-email": "Samsung Email",
    "sfr": "SFR",
    "orange": "Orange",
    "protonmail": "ProtonMail",
    "hey": "HEY",
    "mail-ru": "Mail.ru",
    "fastmail": "Fastmail",
    "laposte": "LaPoste.net",
    "t-online-de": "T-online.de",
    "free-fr": "Free.fr",
    "gmx": "GMX",
    "web-de": "WEB.DE",
    "ionos-1and1": "1&1",
    "rainloop": "RainLoop",
    "wp-pl": "WP.pl"
  },
  "platform": {
    "desktop-app": "Desktop",
    "desktop-webmail": "Desktop Webmail",
    "mobile-webmail": "Mobile Webmail",
    "webmail": "Webmail",
    "ios": "iOS",
    "android": "Android",
    "windows": "Windows",
    "macos": "macOS",
    "windows-mail": "Windows Mail",
    "outlook-com": "Outlook.com"
  }
} as const;
// prettier-ignore
export const CANIEMAIL_DATA = {
  "css-display-flex": {
    "title": "display:flex",
    "url": "https://www.caniemail.com/features/css-display-flex/",
    "lastTestDate": "2021-11-02",
    "notes": {
      "1": "Not supported with non Google accounts.",
      "2": "`display:inline-flex` is not supported."
    },
    "cells": {
      "gmail.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2026-03"
      },
      "gmail.android": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2026-03"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.desktop-webmail": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "yahoo.ios": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "yahoo.android": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "aol.desktop-webmail": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "aol.ios": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "aol.android": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2020-11"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      }
    }
  },
  "css-display-grid": {
    "title": "display:grid",
    "url": "https://www.caniemail.com/features/css-display-grid/",
    "lastTestDate": "2019-02-28",
    "notes": {
      "1": "Not supported with non Google accounts."
    },
    "cells": {
      "gmail.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2026-03"
      },
      "gmail.android": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2026-03"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      }
    }
  },
  "css-position": {
    "title": "position",
    "url": "https://www.caniemail.com/features/css-position/",
    "lastTestDate": "2021-05-16",
    "notes": {
      "1": "Partial. Supports `relative`, `absolute` but not `sticky` and `fixed`.",
      "2": "Partial. Supports `sticky` but not `relative`, `absolute` and `fixed`.",
      "3": "Partial. Supports `relative` but not  `absolute`, `sticky` and `fixed`.",
      "4": "Partial. Supports `relative` and `sticky` but not `absolute` and `fixed`.",
      "5": "Buggy. `fixed` elements scroll with page.",
      "6": "Buggy. `fixed` is replaced by `absolute`."
    },
    "cells": {
      "apple-mail.macos": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "14"
      },
      "apple-mail.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "14.5"
      },
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "orange.desktop-webmail": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2021-05"
      },
      "orange.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2021-05"
      },
      "orange.android": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2021-05"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "outlook.macos": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2023-12"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "outlook.android": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2021-05"
      },
      "samsung-email.android": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "6.0"
      },
      "sfr.desktop-webmail": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "sfr.ios": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "sfr.android": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "aol.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "aol.ios": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "aol.android": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "yahoo.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "yahoo.ios": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "yahoo.android": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-05"
      },
      "hey.desktop-webmail": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-05"
      },
      "fastmail.desktop-webmail": {
        "value": "a",
        "notes": [
          1,
          6
        ],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2022-06"
      },
      "gmx.android": {
        "value": "y",
        "notes": [
          5
        ],
        "version": "2022-06"
      },
      "web-de.desktop-webmail": {
        "value": "y",
        "notes": [
          2
        ],
        "version": "2022-06"
      },
      "web-de.android": {
        "value": "y",
        "notes": [
          5
        ],
        "version": "2022-06"
      },
      "ionos-1and1.android": {
        "value": "y",
        "notes": [
          5
        ],
        "version": "2022-06"
      }
    }
  },
  "css-variables": {
    "title": "CSS Variables (Custom Properties)",
    "url": "https://www.caniemail.com/features/css-variables/",
    "lastTestDate": "2020-02-25",
    "notes": {
      "1": "Partial. The `var()` function is supported, but not the variable declaration.",
      "2": "Partial. Not supported with non Google accounts."
    },
    "cells": {
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2019-08"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [
          1,
          2
        ],
        "version": "2019-08"
      },
      "gmail.android": {
        "value": "n",
        "notes": [
          1,
          2
        ],
        "version": "2019-08"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2020-02"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [],
        "version": "2024-01"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "outlook.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2021-07"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-09"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-09"
      }
    }
  },
  "css-at-import": {
    "title": "@import",
    "url": "https://www.caniemail.com/features/css-at-import/",
    "lastTestDate": "2019-02-28",
    "notes": {},
    "cells": {
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-03"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "outlook.android": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "thunderbird.macos": {
        "value": "n",
        "notes": [],
        "version": "78.5"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "samsung-email.android": {
        "value": "n",
        "notes": [],
        "version": "5.0.10.2"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "sfr.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-08"
      },
      "sfr.android": {
        "value": "n",
        "notes": [],
        "version": "2019-08"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-06"
      },
      "wp-pl.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      }
    }
  },
  "html-link": {
    "title": "<link> element",
    "url": "https://www.caniemail.com/features/html-link/",
    "lastTestDate": "2023-12-21",
    "notes": {},
    "cells": {
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "outlook.android": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      },
      "thunderbird.macos": {
        "value": "n",
        "notes": [],
        "version": "78.5"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "samsung-email.android": {
        "value": "n",
        "notes": [],
        "version": "5.0.10.2"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "sfr.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "sfr.android": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-09"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "wp-pl.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-12"
      }
    }
  },
  "html-style": {
    "title": "<style> element",
    "url": "https://www.caniemail.com/features/html-style/",
    "lastTestDate": "2023-07-27",
    "notes": {
      "1": "Partial. Not supported inside the `<body>`.",
      "2": "Partial. Not supported with non Google accounts.",
      "3": "Buggy. The first `<head>` in the HTML is removed, so `<style>` elements need to be in a second `<head>` element.",
      "4": "Buggy. `<style>` elements need to be declared before their rules are used.",
      "5": "A CSS rule following a CSS comment is ignored. (See [email-bugs#25](https://github.com/hteumeuleu/email-bugs/issues/25).)",
      "6": "The size of the `<style>` tag [is limited to 16 KB](https://github.com/hteumeuleu/email-bugs/issues/90)"
    },
    "cells": {
      "gmail.desktop-webmail": {
        "value": "a",
        "notes": [
          1,
          6
        ],
        "version": "2023-01"
      },
      "gmail.ios": {
        "value": "a",
        "notes": [
          1,
          2
        ],
        "version": "2023-01"
      },
      "gmail.android": {
        "value": "a",
        "notes": [
          1,
          2
        ],
        "version": "2019-06"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-01"
      },
      "outlook.windows": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "a",
        "notes": [
          4
        ],
        "version": "2023-01"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "sfr.ios": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "sfr.android": {
        "value": "n",
        "notes": [],
        "version": "2023-02"
      },
      "protonmail.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2023-01"
      },
      "protonmail.android": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2020-03"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "laposte.ios": {
        "value": "n",
        "notes": [],
        "version": "2025-07"
      },
      "laposte.android": {
        "value": "n",
        "notes": [],
        "version": "2023-02"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-07"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2025-04"
      },
      "rainloop.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2023-02"
      }
    }
  },
  "html-svg": {
    "title": "Embedded <svg> image",
    "url": "https://www.caniemail.com/features/html-svg/",
    "lastTestDate": "2020-02-06",
    "notes": {
      "1": "Buggy. Requires a background on the `<body>`. Can be any type of background, image or a color, can be set as attribute, inline style or in `<style>` block",
      "2": "Not supported. Element is removed along with any fallback content."
    },
    "cells": {
      "apple-mail.macos": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "13"
      },
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [],
        "version": "2024-01"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "outlook.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-07"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2022-11"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      }
    }
  },
  "html-form": {
    "title": "<form> element",
    "url": "https://www.caniemail.com/features/html-form/",
    "lastTestDate": "2019-09-10",
    "notes": {
      "1": "Does not submit in iOS with non Google accounts.",
      "2": "On submit name values are prefixed with `x_`.",
      "3": "Does not submit in preview pane, but does when the email is opened in a new window.",
      "4": "Not supported. `<form>` is transformed into `<noform>`.",
      "5": "Not supported. The `<form>` and its entire content is removed.",
      "6": "Not supported. The `<form>` is there but values are not submitted."
    },
    "cells": {
      "gmail.ios": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2019-09"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-01"
      },
      "outlook.macos": {
        "value": "a",
        "notes": [
          6
        ],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "a",
        "notes": [
          6
        ],
        "version": "2024-01"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2020-01"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2019-09"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.android": {
        "value": "n",
        "notes": [
          5
        ],
        "version": "2020-03"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [
          6
        ],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      }
    }
  },
  "html-object": {
    "title": "<object> element",
    "url": "https://www.caniemail.com/features/html-object/",
    "lastTestDate": "2021-02-20",
    "notes": {
      "1": "Partial support. Does not support Videos resources.",
      "2": "Partial support. Does not support PDF resources.",
      "3": "Not supported. `<object>` is turned into `<noobject>`.",
      "4": "Not supported. The `<object>` element and all its content is removed."
    },
    "cells": {
      "apple-mail.macos": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "14.0"
      },
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-03"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [],
        "version": "2024-01"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "outlook.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "samsung-email.android": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "6.1"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [
          3
        ],
        "version": "2020-10"
      },
      "sfr.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "sfr.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "thunderbird.macos": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "78.7"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-02"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "protonmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [
          3
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.ios": {
        "value": "a",
        "notes": [
          1,
          2
        ],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.ios": {
        "value": "a",
        "notes": [
          1,
          2
        ],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      }
    }
  },
  "html-video": {
    "title": "<video> element",
    "url": "https://www.caniemail.com/features/html-video/",
    "lastTestDate": "2019-09-16",
    "notes": {
      "1": "The `<video>` element is supported, but not the inner `<source>` element so no video can play.",
      "2": "`<video>`, `<source>` and `<track>` tags are replaced by `<u></u>` tags.",
      "3": "Buggy. Support depends on the version of Internet Explorer installed.",
      "4": "`<video>`, `<source>` and `<track>` tags are stripped. The fallback content is shown instead.",
      "5": "Partial support. Requires the `controls` attribute to play.",
      "6": "Partial support. `autoplay` is not supported.",
      "7": "The `<video>` element is supported and the `poster` image is visible, but the video can not play due to a strict Content Security Policy.",
      "8": "The `<video>` element is supported, but the video can not play due to a strict Content Security Policy.",
      "9": "Not supported. The `<video>` element and all its content is removed.",
      "10": "Not supported. The `src` attribute is replaced by `data-src`.",
      "11": "Partial support. The video can be played by doing a right click and play. But `autoplay` and `controls` are not supported."
    },
    "cells": {
      "apple-mail.ios": {
        "value": "a",
        "notes": [
          5,
          6
        ],
        "version": "13.3"
      },
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2019-09"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2019-09"
      },
      "gmail.android": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2019-09"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2020-02"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2019-09"
      },
      "outlook.macos": {
        "value": "y",
        "notes": [
          11
        ],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [
          8
        ],
        "version": "2024-01"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [
          8
        ],
        "version": "2021-05"
      },
      "outlook.android": {
        "value": "n",
        "notes": [
          8
        ],
        "version": "2021-05"
      },
      "samsung-email.android": {
        "value": "a",
        "notes": [
          5
        ],
        "version": "6.0"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "aol.ios": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "aol.android": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2019-09"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [
          7
        ],
        "version": "2020-03"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "protonmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-03"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [
          9
        ],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [
          10
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.ios": {
        "value": "y",
        "notes": [
          5,
          6
        ],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.ios": {
        "value": "y",
        "notes": [
          5,
          6
        ],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [
          9
        ],
        "version": "2022-11"
      },
      "ionos-1and1.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      }
    }
  },
  "html-audio": {
    "title": "<audio> element",
    "url": "https://www.caniemail.com/features/html-audio/",
    "lastTestDate": "2020-04-21",
    "notes": {
      "1": "Does not play.",
      "2": "The `src` attribute is transformed into `proton-src`.",
      "3": "The `<audio>` element is supported but can not be played.",
      "4": "The `<audio>` element is supported, but the video can not play due to a strict Content Security Policy.",
      "5": "Not supported. The `<audio>` element and all its content is removed.",
      "6": "Not supported. The `src` attribute is replaced by `data-src`."
    },
    "cells": {
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "orange.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.ios": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "orange.android": {
        "value": "n",
        "notes": [],
        "version": "2024-04"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "outlook.macos": {
        "value": "n",
        "notes": [],
        "version": "16.80"
      },
      "outlook.outlook-com": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2024-01"
      },
      "outlook.ios": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "outlook.android": {
        "value": "n",
        "notes": [
          4
        ],
        "version": "2021-05"
      },
      "aol.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "aol.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "aol.android": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "yahoo.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "yahoo.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "yahoo.android": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "protonmail.desktop-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2020-04"
      },
      "protonmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "protonmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-04"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "mail-ru.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-10"
      },
      "fastmail.desktop-webmail": {
        "value": "n",
        "notes": [
          5
        ],
        "version": "2021-07"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [
          6
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "gmx.ios": {
        "value": "n",
        "notes": [
          3
        ],
        "version": "2022-11"
      },
      "gmx.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "web-de.ios": {
        "value": "n",
        "notes": [
          3
        ],
        "version": "2022-11"
      },
      "web-de.android": {
        "value": "n",
        "notes": [],
        "version": "2022-11"
      },
      "ionos-1and1.desktop-webmail": {
        "value": "n",
        "notes": [
          5
        ],
        "version": "2022-11"
      }
    }
  },
  "css-width": {
    "title": "width property",
    "url": "https://www.caniemail.com/features/css-width/",
    "lastTestDate": "2019-09-27",
    "notes": {
      "1": "Partial. Not supported on `<body>`, `<span>`, `<div>`, `<p>` or `<img>` elements.",
      "2": "Buggy. The webmail has a generic style that sets `table { width:inherit; }`."
    },
    "cells": {
      "outlook.windows": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2019"
      },
      "laposte.desktop-webmail": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2021-08"
      }
    }
  },
  "css-max-width": {
    "title": "max-width",
    "url": "https://www.caniemail.com/features/css-max-width/",
    "lastTestDate": "2019-08-02",
    "notes": {
      "1": "Partial. Only works on `<table>` elements.",
      "2": "Partial. Doesn't work on `<table>` elements, as per [CSS 2.1 specification](https://www.w3.org/TR/CSS2/visudet.html#min-max-widths)."
    },
    "cells": {
      "outlook.windows": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2020-01"
      }
    }
  },
  "css-float": {
    "title": "float",
    "url": "https://www.caniemail.com/features/css-float/",
    "lastTestDate": "2024-05-08",
    "notes": {
      "1": "Not supported. `table` and `img` elements can use an `align` attribute to get a similar effect.",
      "2": "Partial. Logical property values `inline-start` and `inline-end` are not supported."
    },
    "cells": {
      "gmail.ios": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "gmail.android": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "outlook.windows": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [
          1
        ],
        "version": "2019-02"
      },
      "yahoo.desktop-webmail": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "yahoo.ios": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "yahoo.android": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "aol.desktop-webmail": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "aol.ios": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "aol.android": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "gmx.desktop-webmail": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      },
      "web-de.desktop-webmail": {
        "value": "a",
        "notes": [
          2
        ],
        "version": "2024-05"
      }
    }
  },
  "css-background-image": {
    "title": "background-image",
    "url": "https://www.caniemail.com/features/css-background-image/",
    "lastTestDate": "2023-07-24",
    "notes": {
      "1": "Partial. Not supported with non Google accounts.",
      "2": "Buggy. Requires at least one `<img>` element in the email to download all images.",
      "3": "Partial. Does not support multiple values. The comma between two values is removed.",
      "4": "Partial. Images URL must be between quotes.",
      "5": "Background images can be used in VML. See [backgrounds.cm](https://backgrounds.cm/) and [VML documentation](https://docs.microsoft.com/en-us/windows/win32/vml/web-workshop---how-to-use-vml-on-web-pages-----fill--element).",
      "6": "Partial and buggy. Removes the entire `style` attribute or `<style>` tag when a `url()` function with a valid image URL is present. See [Gmail rolling out changes that strip CSS with background images](https://freshinbox.com/blog/gmail-rolling-out-changes-that-strip-background-image-css/) and [Gmail and background images](https://parcel.io/blog/gmail-and-background-images)."
    },
    "cells": {
      "outlook.windows": {
        "value": "n",
        "notes": [
          5
        ],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2019-02"
      },
      "yahoo.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "yahoo.ios": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "yahoo.android": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "aol.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "aol.ios": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "aol.android": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2021-10"
      },
      "t-online-de.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-11"
      },
      "free-fr.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2021-11"
      },
      "gmx.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2022-06"
      },
      "web-de.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2022-06"
      }
    }
  },
  "image-base64": {
    "title": "Base 64 image format",
    "url": "https://www.caniemail.com/features/image-base64/",
    "lastTestDate": "2020-02-06",
    "notes": {
      "1": "Partial: Does not render Base 64 gif format.",
      "2": "Not supported. The `src` is turned into a `nosrc` attribute.",
      "3": "Partial: Only supports Base 64 png format."
    },
    "cells": {
      "gmail.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2024-05"
      },
      "gmail.ios": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "gmail.android": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "gmail.mobile-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "outlook.windows": {
        "value": "a",
        "notes": [
          1
        ],
        "version": "2019"
      },
      "outlook.windows-mail": {
        "value": "n",
        "notes": [],
        "version": "2020-02"
      },
      "sfr.desktop-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2020-02"
      },
      "hey.desktop-webmail": {
        "value": "n",
        "notes": [],
        "version": "2020-06"
      },
      "laposte.desktop-webmail": {
        "value": "n",
        "notes": [
          2
        ],
        "version": "2021-08"
      },
      "gmx.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2022-09"
      },
      "web-de.desktop-webmail": {
        "value": "a",
        "notes": [
          3
        ],
        "version": "2022-09"
      }
    }
  }
} as const;
