import type { TemplateContent } from "@templatical/types";
import { slugFor } from "./template-name";

/**
 * Demo version store: one localStorage array per template, appended to by the
 * templates provider's `save` and read by the version-history provider.
 *
 * It sits between the two providers on purpose. That is exactly the arrangement
 * the contract describes — the editor never records a version, the thing that
 * *persists* does — and having the demo do it the same way is what makes the
 * playground's history fill up as you work.
 */
const versionStores = new Map<string, VersionStore>();

export interface StoredVersion {
  id: string;
  createdAt: string;
  isAutomatic: boolean;
  content: TemplateContent;
}

export interface VersionStore {
  read: () => StoredVersion[];
  append: (content: TemplateContent, isAutomatic: boolean) => StoredVersion;
}

/**
 * How many of the newest versions carry their content in `list()`.
 *
 * The hint is evaluated per entry, so a store may hydrate the recent ones and
 * make the rest a round-trip. Doing that here keeps both paths live in the demo:
 * scrubbing the recent versions never awaits, and stepping past the cut-off
 * exercises `get` — and the editor's cache, so the second visit is instant too.
 */
export const HYDRATED_VERSIONS = 5;

export function versionStoreFor(templateName: string): VersionStore {
  const cached = versionStores.get(templateName);
  if (cached) return cached;

  const key = `templatical:versions:${slugFor(templateName)}`;

  function read(): StoredVersion[] {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredVersion[]) : [];
    } catch {
      return [];
    }
  }

  function append(
    content: TemplateContent,
    isAutomatic: boolean,
  ): StoredVersion {
    const version: StoredVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      isAutomatic,
      content: JSON.parse(JSON.stringify(content)) as TemplateContent,
    };
    // Newest first, matching the order the editor renders verbatim.
    localStorage.setItem(key, JSON.stringify([version, ...read()]));
    return version;
  }

  const store: VersionStore = { read, append };
  versionStores.set(templateName, store);
  return store;
}
