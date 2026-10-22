import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API_URL = "https://www.caniemail.com/api/data.json";
const root = new URL("../", import.meta.url);
const slugFile = new URL("src/compatibility/slugs.json", root);
const outputFile = new URL(
  "src/compatibility/data/caniemail.generated.ts",
  root,
);

/** Transform raw API bytes without fetching, sorting version keys or adding a clock value. */
export function transformCaniemail(raw, slugs) {
  const api = JSON.parse(raw);
  // JSON.parse reorders integer-looking object keys numerically. Prefix them
  // while parsing a second copy so version entries retain their source order.
  const orderPrefix = "__caniemail_version_";
  const orderedApi = JSON.parse(
    raw.replace(/"(\d+)":/g, `"${orderPrefix}$1":`),
  );
  if (
    typeof api.api_version !== "string" ||
    !api.api_version.startsWith("1.")
  ) {
    throw new Error(`Unsupported caniemail API version: ${api.api_version}`);
  }
  const data = {};
  for (const slug of slugs) {
    const feature = api.data.find((entry) => entry.slug === slug);
    if (!feature) throw new Error(`Missing caniemail feature: ${slug}`);
    const orderedFeature = orderedApi.data.find((entry) => entry.slug === slug);
    const cells = {};
    for (const [family, platforms] of Object.entries(orderedFeature.stats)) {
      for (const [platform, versions] of Object.entries(platforms)) {
        const entries = Object.entries(versions);
        const [orderedVersion, verdict] = entries.at(-1) ?? [];
        const version = orderedVersion?.startsWith(orderPrefix)
          ? orderedVersion.slice(orderPrefix.length)
          : orderedVersion;
        if (typeof verdict !== "string" || !version) continue;
        const value = verdict[0];
        const notes = [...verdict.matchAll(/#(\d+)/g)].map((match) =>
          Number(match[1]),
        );
        if (value === "u" || (value === "y" && notes.length === 0)) continue;
        if (value !== "y" && value !== "a" && value !== "n") {
          throw new Error(
            `Unknown verdict ${slug}/${family}.${platform}: ${verdict}`,
          );
        }
        cells[`${family}.${platform}`] = { value, notes, version };
      }
    }
    data[slug] = {
      title: feature.title,
      url: feature.url,
      lastTestDate: feature.last_test_date,
      notes: feature.notes_by_num ?? {},
      cells,
    };
  }
  const date = api.last_update_date.slice(0, 10);
  const source = {
    url: API_URL,
    apiVersion: api.api_version,
    lastUpdateDate: api.last_update_date,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
  return [
    "/*! caniemail data © Rémi Parmentier, MIT — https://github.com/hteumeuleu/caniemail */",
    `export const CANIEMAIL_SOURCE = ${JSON.stringify(source)} as const;`,
    `export const CANIEMAIL_DATA_DATE = ${JSON.stringify(date)};`,
    "// prettier-ignore",
    `export const CANIEMAIL_NICENAMES = ${JSON.stringify({ family: api.nicenames.family, platform: api.nicenames.platform }, null, 2)} as const;`,
    "// prettier-ignore",
    `export const CANIEMAIL_DATA = ${JSON.stringify(data, null, 2)} as const;`,
    "",
  ].join("\n");
}

export async function syncCaniemail() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`caniemail HTTP ${response.status}`);
  const raw = await response.text();
  const slugs = JSON.parse(await readFile(slugFile, "utf8"));
  const output = transformCaniemail(raw, slugs);
  await writeFile(outputFile, output);
  return outputFile;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  syncCaniemail().then(
    (path) => process.stdout.write(`Wrote ${fileURLToPath(path)}\n`),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
