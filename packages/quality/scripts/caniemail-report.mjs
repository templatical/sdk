import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  fetchCaniemail,
  isSupportedApiVersion,
  lastListedVerdicts,
  parseCaniemail,
  snapshotCells,
} from "./sync-caniemail.mjs";

const root = new URL("../", import.meta.url);
const snapshotFile = new URL(
  "src/compatibility/data/caniemail.generated.ts",
  root,
);
const slugFile = new URL("src/compatibility/slugs.json", root);
const pinnedFile = new URL("src/compatibility/pinned-notes.json", root);
const candidateFamilies = new Set(["gmail", "outlook"]);

/** caniemail dates look like `2026-09-16 13:05:00 +0000`. */
function parseUpdateDate(value) {
  const match =
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(
      value ?? "",
    );
  if (!match) throw new Error(`Unrecognized caniemail date: ${value}`);
  return Date.parse(`${match[1]}T${match[2]}${match[3]}:${match[4]}`);
}

/** Escape `<` and `>` outside code spans so GitHub doesn't read them as HTML. */
function escapeText(text) {
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 ? part : part.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    )
    .join("");
}

function quote(text) {
  return `"${escapeText(text)}"`;
}

function cellLabel(cell) {
  return cell ? [cell.value, ...cell.notes.map((n) => `#${n}`)].join(" ") : "";
}

function clientName(id, nicenames) {
  const dot = id.indexOf(".");
  const family = nicenames.family[id.slice(0, dot)] ?? id.slice(0, dot);
  const platform = nicenames.platform[id.slice(dot + 1)] ?? id.slice(dot + 1);
  return platform.toLowerCase().includes(family.toLowerCase())
    ? platform
    : `${family} ${platform}`;
}

function byNumber(a, b) {
  return Number(a) - Number(b);
}

/**
 * Compare upstream caniemail data with the vendored snapshot (the generated
 * module's exports). Returns Markdown for the maintainer, or "" when upstream
 * is not newer than the snapshot.
 */
export function reportCaniemail(raw, snapshot, slugs, pinnedNotes) {
  const { api, ordered } = parseCaniemail(raw);
  const ours = snapshot.CANIEMAIL_SOURCE.lastUpdateDate;
  if (parseUpdateDate(api.last_update_date) <= parseUpdateDate(ours)) {
    return "";
  }
  const out = [
    `caniemail has newer data: upstream \`last_update_date\` is \`${api.last_update_date}\`; the vendored snapshot has \`${ours}\`.`,
    "",
  ];
  if (!isSupportedApiVersion(api)) {
    out.push(
      `The upstream API version is \`${api.api_version}\`, and \`sync:caniemail\` only accepts \`1.x\`. Update \`packages/quality/scripts/sync-caniemail.mjs\` for the new format before syncing.`,
      "",
    );
    return out.join("\n");
  }

  const nicenames = {
    family: {
      ...snapshot.CANIEMAIL_NICENAMES.family,
      ...api.nicenames?.family,
    },
    platform: {
      ...snapshot.CANIEMAIL_NICENAMES.platform,
      ...api.nicenames?.platform,
    },
  };
  const features = new Map(api.data.map((entry) => [entry.slug, entry]));
  const orderedFeatures = new Map(
    ordered.data.map((entry) => [entry.slug, entry]),
  );
  const blockers = [];
  const verdictRows = [];
  const pinnedChanges = [];
  const noteChanges = [];

  for (const slug of slugs) {
    const feature = features.get(slug);
    if (!feature) {
      blockers.push(`- \`${slug}\`: not in the upstream data.`);
      continue;
    }
    const kept = snapshot.CANIEMAIL_DATA[slug] ?? { cells: {}, notes: {} };
    try {
      const cells = snapshotCells(slug, orderedFeatures.get(slug).stats);
      for (const id of new Set([
        ...Object.keys(cells),
        ...Object.keys(kept.cells),
      ])) {
        const before = cellLabel(kept.cells[id]);
        const after = cellLabel(cells[id]);
        if (before === after) continue;
        const show = (label) => (label ? `\`${label}\`` : "—");
        verdictRows.push(
          `| \`${slug}\` | ${clientName(id, nicenames)} | ${show(before)} | ${show(after)} |`,
        );
      }
    } catch (error) {
      blockers.push(`- \`${slug}\`: ${error.message}.`);
    }

    const notes = feature.notes_by_num ?? {};
    const pinned = pinnedNotes[slug] ?? {};
    for (const number of Object.keys(pinned).sort(byNumber)) {
      if (notes[number] === pinned[number]) continue;
      pinnedChanges.push(
        `- \`${slug}\` #${number}: ${quote(pinned[number])} → ${notes[number] === undefined ? "removed" : quote(notes[number])}`,
      );
    }
    for (const number of [
      ...new Set([...Object.keys(kept.notes), ...Object.keys(notes)]),
    ].sort(byNumber)) {
      const before = kept.notes[number];
      const after = notes[number];
      if (number in pinned || before === after) continue;
      noteChanges.push(
        before === undefined
          ? `- \`${slug}\` #${number} added: ${quote(after)}`
          : after === undefined
            ? `- \`${slug}\` #${number} removed (was ${quote(before)})`
            : `- \`${slug}\` #${number} changed: ${quote(before)} → ${quote(after)}`,
      );
    }
  }

  const since = snapshot.CANIEMAIL_DATA_DATE;
  const registered = new Set(slugs);
  const candidates = [];
  for (const feature of [...api.data].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )) {
    if (registered.has(feature.slug)) continue;
    if (typeof feature.last_test_date !== "string") continue;
    if (feature.last_test_date <= since) continue;
    const verdicts = lastListedVerdicts(
      orderedFeatures.get(feature.slug).stats,
    );
    // Like the lint's client lists: a family whose listed platforms all fail
    // prints as its name, otherwise as `Family (Platform, Platform)`.
    const groups = [];
    for (const family of candidateFamilies) {
      const listed = verdicts.filter((entry) => entry.family === family);
      const failing = listed.filter((entry) => entry.verdict[0] === "n");
      if (failing.length === 0) continue;
      const name = nicenames.family[family] ?? family;
      groups.push(
        failing.length === listed.length
          ? name
          : `${name} (${failing.map((entry) => nicenames.platform[entry.platform] ?? entry.platform).join(", ")})`,
      );
    }
    if (groups.length === 0) continue;
    candidates.push(
      `- [${escapeText(feature.title)}](${feature.url}) (\`${feature.slug}\`), tested ${feature.last_test_date}: \`n\` in ${groups.join(", ")}`,
    );
  }

  const none = ["None."];
  const upstreamDate = api.last_update_date.slice(0, 10);
  if (blockers.length > 0) {
    out.push(
      "### Blocks the sync",
      "",
      "`sync:caniemail` fails until these are resolved:",
      "",
      ...blockers,
      "",
    );
  }
  out.push(
    "### Verdict changes in registered features",
    "",
    ...(verdictRows.length > 0
      ? [
          "A cell is the client's last-listed verdict as the snapshot keeps it: `y`, `a` (partial) or `n`, with its note numbers. — means supported without notes, or untested.",
          "",
          "| Feature | Client | Snapshot | Upstream |",
          "| --- | --- | --- | --- |",
          ...verdictRows,
        ]
      : none),
    "",
    "### Pinned notes that changed",
    "",
    ...(pinnedChanges.length > 0
      ? [
          "A detector narrows its verdict with each of these notes. Re-check its predicate in `noteExcludes` (`packages/quality/src/compatibility/support.ts`).",
          "",
          ...pinnedChanges,
        ]
      : none),
    "",
    "### Other note changes in registered features",
    "",
    ...(noteChanges.length > 0 ? noteChanges : none),
    "",
    "### Candidate features",
    "",
    `Unregistered features last tested after ${since} that a Gmail or Outlook platform doesn't support. Add a detector only when the feature loses content or layout there, not when it only degrades.`,
    "",
    ...(candidates.length > 0 ? candidates : none),
    "",
    "### Refresh",
    "",
    "1. Run `pnpm --filter @templatical/quality run sync:caniemail`.",
    `2. Replace \`${since}\` with \`${upstreamDate}\` in every file \`git grep -l ${since} -- apps/docs/quality apps/docs/de/quality\` lists, then run \`pnpm --filter @templatical/docs run build:agent-surface\`.`,
    "3. Run `pnpm --filter @templatical/quality run build`, then `pnpm --filter @templatical/quality run test` and `pnpm --filter @templatical/docs run test`. A changed pinned note fails `data.test.ts`: update `packages/quality/src/compatibility/pinned-notes.json`, the predicate in `noteExcludes`, and the rule's **Narrowing** line in both rule catalogs. `apps/docs/tests/docs-caniemail-parity.test.ts` checks the docs date and the cited note numbers.",
    "4. A new detector registers its slug in `packages/quality/src/compatibility/slugs.json`. Run the sync again after adding it.",
    "5. Add a changeset for `@templatical/quality` (`pnpm exec changeset`): the refreshed data ships in the package.",
    "",
  );
  return out.join("\n");
}

export async function caniemailReport() {
  const [raw, snapshot, slugs, pinnedNotes] = await Promise.all([
    fetchCaniemail(),
    // Node strips the generated module's types (`as const`) natively.
    import(snapshotFile.href),
    readFile(slugFile, "utf8").then(JSON.parse),
    readFile(pinnedFile, "utf8").then(JSON.parse),
  ]);
  return reportCaniemail(raw, snapshot, slugs, pinnedNotes);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  caniemailReport().then(
    (report) => process.stdout.write(report),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
