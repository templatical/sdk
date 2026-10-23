import {
  CANIEMAIL_DATA,
  CANIEMAIL_NICENAMES,
} from "./data/caniemail.generated";
import pinnedNotes from "./pinned-notes.json";
import type { ClientSupport } from "../types";

type Feature = {
  url: string;
  lastTestDate: string;
  notes: Record<string, string>;
  cells: Record<
    string,
    { value: "y" | "a" | "n"; notes: readonly number[]; version: string }
  >;
};

export const FEATURES: Record<string, Feature> = CANIEMAIL_DATA;

/**
 * Pinned notes narrow the support verdict for the detected usage; their
 * predicates are in `noteExcludes`. The text lives in JSON so the caniemail
 * freshness report (scripts/caniemail-report.mjs) can flag a changed note.
 */
export const PINNED_NOTES: Record<string, Record<number, string>> = pinnedNotes;

const familyOrder = [
  "gmail",
  "outlook",
  "apple-mail",
  "yahoo",
  "samsung-email",
];
const familyNames: Record<string, string> = CANIEMAIL_NICENAMES.family;
const platformNames: Record<string, string> = CANIEMAIL_NICENAMES.platform;

function noteExcludes(slug: string, note: number, usage: string): boolean {
  switch (slug) {
    case "css-display-flex":
      return note === 2 && usage === "inline-flex";
    case "css-position": {
      const supported: Record<number, string[]> = {
        1: ["relative", "absolute"],
        2: ["sticky"],
        3: ["relative"],
        4: ["relative", "sticky"],
      };
      return supported[note] !== undefined && !supported[note].includes(usage);
    }
    case "html-style":
      return note === 1;
    case "css-width":
      return note === 1;
    case "css-max-width":
      return note === 1;
    case "image-base64":
      return (
        (note === 1 && usage === "image/gif") ||
        (note === 3 && usage !== "image/png")
      );
    default:
      return false;
  }
}

export function supportFor(slug: string, usage = ""): ClientSupport[] {
  const feature = FEATURES[slug];
  if (!feature) return [];
  const clients: ClientSupport[] = [];
  for (const [id, cell] of Object.entries(feature.cells)) {
    const dot = id.indexOf(".");
    const family = id.slice(0, dot);
    const platform = id.slice(dot + 1);
    const narrowed = cell.notes.some((note) => noteExcludes(slug, note, usage));
    const support =
      narrowed || cell.value === "n"
        ? "unsupported"
        : cell.value === "a"
          ? "partial"
          : null;
    if (!support) continue;
    const familyName = familyNames[family] ?? family;
    const platformName = platformNames[platform] ?? platform;
    clients.push({
      id,
      name: platformName.toLowerCase().includes(familyName.toLowerCase())
        ? platformName
        : `${familyName} ${platformName}`,
      support,
      notes: cell.notes
        .map((n) => feature.notes[String(n)])
        .filter((note): note is string => !!note),
      testedAt: feature.lastTestDate,
    });
  }
  return clients;
}

/** Group a bucket of clients by family, with priority families first. */
export function formatClientGroups(
  clients: ClientSupport[],
  bucket: ClientSupport["support"],
  locale: string,
): string {
  const allByFamily = new Map<string, ClientSupport[]>();
  const selected = new Map<string, ClientSupport[]>();
  for (const client of clients) {
    const family = client.id.split(".")[0];
    allByFamily.set(family, [...(allByFamily.get(family) ?? []), client]);
    if (client.support === bucket)
      selected.set(family, [...(selected.get(family) ?? []), client]);
  }
  const families = [...selected.keys()].sort((a, b) => {
    const ai = familyOrder.indexOf(a);
    const bi = familyOrder.indexOf(b);
    if (ai !== bi) return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    return (familyNames[a] ?? a).localeCompare(familyNames[b] ?? b);
  });
  const groups = families.map((family) => {
    const name = familyNames[family] ?? family;
    const members = selected.get(family)!;
    if (members.length === allByFamily.get(family)!.length) return name;
    const platforms = members.map(
      (client) => platformNames[client.id.split(".")[1]] ?? client.name,
    );
    return `${name} (${platforms.join(", ")})`;
  });
  const limited = groups.slice(0, 4);
  if (groups.length > 4)
    limited.push(
      `${groups.length - 4} ${locale.startsWith("de") ? "weitere" : "more"}`,
    );
  return new Intl.ListFormat(locale.startsWith("de") ? "de" : "en", {
    type: "conjunction",
  }).format(limited);
}
