import {
  createLocalStorageMediaProvider,
  createLocalStorageSavedBlocksProvider,
} from "@templatical/core";
import type {
  Comment,
  CommentsProvider,
  EditorUser,
  MediaAsset,
  MediaProvider,
  SavedBlock,
  SavedBlocksProvider,
  TemplateContent,
  TemplateSaveTrigger,
  TemplateVersion,
  TemplatesProvider,
  TestEmailProvider,
  VersionHistoryProvider,
} from "@templatical/types";

/** Shared slug for every per-document storage key (and the demo template id). */
function slugFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function savedBlocksKeyFor(name: string): string {
  return `templatical:saved-blocks:${slugFor(name)}`;
}

function templatesKeyFor(name: string): string {
  return `templatical:template:${slugFor(name)}`;
}

function seedSavedBlocks(
  key: string,
  defaults: SavedBlock[] | undefined,
): void {
  if (!defaults?.length) return;
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(key) !== null) return;
  localStorage.setItem(key, JSON.stringify(defaults));
}

export interface ProviderCacheOptions {
  readonly?: boolean;
  delay?: number;
  autosave?: boolean;
}

export function providerCacheKey(
  name: string,
  options: ProviderCacheOptions = {},
): string {
  return [
    name,
    options.readonly ? "readonly" : "rw",
    `delay=${options.delay ?? 0}`,
    options.autosave ? "autosave" : "manual",
  ].join(":");
}

export interface SavedBlocksProviderOptions extends ProviderCacheOptions {
  seed?: SavedBlock[];
}

const savedBlocksProviders = new Map<string, SavedBlocksProvider>();

export function savedBlocksProviderFor(
  name: string,
  options: SavedBlocksProviderOptions = {},
): SavedBlocksProvider {
  const cacheKey = providerCacheKey(name, options);
  const cached = savedBlocksProviders.get(cacheKey);
  if (cached) return cached;

  const key = savedBlocksKeyFor(name);
  seedSavedBlocks(key, options.seed);
  const base = createLocalStorageSavedBlocksProvider({ key });

  const delayMs = options.delay ?? 0;
  const withDelay: SavedBlocksProvider =
    delayMs > 0
      ? {
          ...base,
          list: async (params) => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return base.list(params);
          },
        }
      : base;

  const provider = options.readonly
    ? {
        ...withDelay,
        create: false as const,
        update: false as const,
        delete: false as const,
      }
    : withDelay;

  savedBlocksProviders.set(cacheKey, provider);
  return provider;
}

const MEDIA_STORAGE_KEY = "templatical:media";

const PLAYGROUND_MEDIA_SEED: MediaAsset[] = [
  {
    id: "seed-product-shot",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80",
    filename: "product-shot.jpg",
    alt: "Product shot",
    mimeType: "image/jpeg",
  },
  {
    id: "seed-team-photo",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&q=80",
    filename: "team-photo.jpg",
    alt: "Team photo",
    mimeType: "image/jpeg",
  },
  {
    id: "seed-abstract",
    url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=600&q=80",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=200&q=80",
    filename: "abstract.jpg",
    alt: "Abstract",
    mimeType: "image/jpeg",
  },
];

function seedMediaLibrary(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MEDIA_STORAGE_KEY) !== null) return;
  localStorage.setItem(
    MEDIA_STORAGE_KEY,
    JSON.stringify(PLAYGROUND_MEDIA_SEED),
  );
}

let mediaProvider: MediaProvider | undefined;

export function mediaProviderFor(): MediaProvider {
  if (mediaProvider) return mediaProvider;
  seedMediaLibrary();
  mediaProvider = createLocalStorageMediaProvider({ key: MEDIA_STORAGE_KEY });
  return mediaProvider;
}

interface StoredVersion {
  id: string;
  createdAt: string;
  isAutomatic: boolean;
  content: TemplateContent;
}

interface VersionStore {
  read: () => StoredVersion[];
  append: (content: TemplateContent, isAutomatic: boolean) => StoredVersion;
}

const HYDRATED_VERSIONS = 5;
const versionStores = new Map<string, VersionStore>();

function versionStoreFor(name: string): VersionStore {
  const cached = versionStores.get(name);
  if (cached) return cached;

  const key = `templatical:versions:${slugFor(name)}`;

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
    localStorage.setItem(key, JSON.stringify([version, ...read()]));
    return version;
  }

  const store: VersionStore = { read, append };
  versionStores.set(name, store);
  return store;
}

export type VersionHistoryProviderOptions = ProviderCacheOptions;

const versionHistoryProviders = new Map<string, VersionHistoryProvider>();

export function versionHistoryProviderFor(
  name: string,
  options: VersionHistoryProviderOptions = {},
): VersionHistoryProvider {
  const cacheKey = providerCacheKey(name, options);
  const cached = versionHistoryProviders.get(cacheKey);
  if (cached) return cached;

  const store = versionStoreFor(name);
  const templates = templatesProviderFor(name);

  function requireVersion(versionId: string): StoredVersion {
    const version = store.read().find((v) => v.id === versionId);
    if (!version) throw new Error(`No version stored under "${versionId}"`);
    return version;
  }

  const base: VersionHistoryProvider = {
    list: async () => ({
      versions: store.read().map((version, index) => {
        const entry: TemplateVersion = {
          id: version.id,
          createdAt: version.createdAt,
          isAutomatic: version.isAutomatic,
        };
        if (index < HYDRATED_VERSIONS) entry.content = version.content;
        return entry;
      }),
    }),
    get: async (_templateId, versionId) => requireVersion(versionId).content,
    create: async (_templateId, content) => {
      const version = store.append(content, false);
      return {
        id: version.id,
        createdAt: version.createdAt,
        isAutomatic: false,
        content: version.content,
      };
    },
    restore: async (templateId, versionId) => {
      const content = requireVersion(versionId).content;
      if (typeof templates.save !== "function") {
        throw new Error("Templates provider is read-only — cannot restore.");
      }
      return templates.save(templateId, { content });
    },
  };

  const provider = options.readonly
    ? { ...base, restore: false as const }
    : base;

  versionHistoryProviders.set(cacheKey, provider);
  return provider;
}

interface StoredTemplate {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  content: TemplateContent;
}

export type TemplatesProviderOptions = ProviderCacheOptions;

const templatesProviders = new Map<string, TemplatesProvider>();

export function templatesProviderFor(
  name: string,
  options: TemplatesProviderOptions = {},
): TemplatesProvider {
  const cacheKey = providerCacheKey(name, options);
  const cached = templatesProviders.get(cacheKey);
  if (cached) return cached;

  const key = templatesKeyFor(name);

  function read(): StoredTemplate | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as StoredTemplate;
    } catch {
      return null;
    }
  }

  function write(stored: StoredTemplate): StoredTemplate {
    localStorage.setItem(key, JSON.stringify(stored));
    return stored;
  }

  function requireStored(templateId: string): StoredTemplate {
    const stored = read();
    if (!stored || stored.id !== templateId) {
      throw new Error(`No template stored under "${templateId}"`);
    }
    return stored;
  }

  const versions = versionStoreFor(name);

  const base: TemplatesProvider = {
    load: async (templateId) => requireStored(templateId),
    create: async (input) => {
      return write({
        id: slugFor(name),
        name: input.name,
        content: input.content,
        createdAt: new Date().toISOString(),
      });
    },
    save: async (templateId, patch) => {
      const stored = write({
        ...requireStored(templateId),
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      if (patch.content) versions.append(patch.content, true);
      return stored;
    },
    onSaved: (_template, { trigger }) => {
      const w = window as unknown as {
        __tplPlaygroundSaveTriggers?: TemplateSaveTrigger[];
      };
      (w.__tplPlaygroundSaveTriggers ??= []).push(trigger);
    },
  };

  const provider = options.readonly
    ? { ...base, create: false as const, save: false as const }
    : base;

  templatesProviders.set(cacheKey, provider);
  return provider;
}

/** Who the playground says you are. Drives "You" and the edit/delete affordances. */
export const PLAYGROUND_USER: EditorUser = {
  id: "playground-user",
  name: "Playground User",
};

export type CommentsProviderOptions = ProviderCacheOptions;

const commentsProviders = new Map<string, CommentsProvider>();

export function commentsProviderFor(
  name: string,
  options: CommentsProviderOptions = {},
): CommentsProvider {
  const cacheKey = providerCacheKey(name, options);
  const cached = commentsProviders.get(cacheKey);
  if (cached) return cached;

  const key = `templatical:comments:${slugFor(name)}`;

  function read(): Comment[] {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Comment[]) : [];
    } catch {
      return [];
    }
  }

  function write(threads: Comment[]): void {
    localStorage.setItem(key, JSON.stringify(threads));
  }

  function locate(
    threads: Comment[],
    commentId: string,
  ): { thread: Comment; reply?: Comment } | null {
    for (const thread of threads) {
      if (thread.id === commentId) return { thread };
      for (const reply of thread.replies ?? []) {
        if (reply.id === commentId) return { thread, reply };
      }
    }
    return null;
  }

  function nextId(): string {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const base: CommentsProvider = {
    list: async () => read(),

    create: async (_templateId, input) => {
      const threads = read();
      const comment: Comment = {
        id: nextId(),
        body: input.body,
        author: { ...PLAYGROUND_USER },
        createdAt: new Date().toISOString(),
        blockId: input.blockId ?? null,
        parentId: input.parentId ?? null,
        resolvedAt: null,
      };

      if (input.parentId) {
        const found = locate(threads, input.parentId);
        if (!found) {
          throw new Error(`No thread stored under "${input.parentId}"`);
        }
        found.thread.replies = [...(found.thread.replies ?? []), comment];
      } else {
        threads.push(comment);
      }
      write(threads);
      return comment;
    },

    update: async (_templateId, commentId, patch) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) throw new Error(`No comment stored under "${commentId}"`);
      const target = found.reply ?? found.thread;
      if (patch.body !== undefined) target.body = patch.body;
      target.updatedAt = new Date().toISOString();
      write(threads);
      return target;
    },

    delete: async (_templateId, commentId) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) return;
      if (found.reply) {
        found.thread.replies = (found.thread.replies ?? []).filter(
          (r) => r.id !== commentId,
        );
        write(threads);
        return;
      }
      write(threads.filter((t) => t.id !== commentId));
    },

    setResolved: async (_templateId, commentId, resolved) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) throw new Error(`No comment stored under "${commentId}"`);
      const target = found.reply ?? found.thread;
      target.resolvedAt = resolved ? new Date().toISOString() : null;
      target.resolvedBy = resolved ? { ...PLAYGROUND_USER } : null;
      write(threads);
      return target;
    },
  };

  const provider: CommentsProvider = options.readonly
    ? {
        ...base,
        create: false as const,
        update: false as const,
        delete: false as const,
        setResolved: false as const,
      }
    : base;

  commentsProviders.set(cacheKey, provider);
  return provider;
}

const FAKE_SEND_LATENCY_MS = 800;

export const testEmailProvider: TestEmailProvider = {
  includeMjml: true,
  allowedRecipients: ["you@example.com", "teammate@example.com"],

  send: async (payload) => {
    await new Promise((resolve) => setTimeout(resolve, FAKE_SEND_LATENCY_MS));

    console.info("[playground] test email 'sent'", {
      recipient: payload.recipient,
      blocks: payload.content.blocks.length,
      mjmlBytes: payload.mjml?.length ?? null,
      allowedRecipients: payload.allowedRecipients ?? null,
    });

    (
      window as { __tplPlaygroundLastTestEmail?: unknown }
    ).__tplPlaygroundLastTestEmail = payload;
  },
};

let lastMjmlWarnings: string[] = [];

export function getLastMjmlWarnings(): readonly string[] {
  return lastMjmlWarnings;
}

export async function compileMjmlDemo(mjml: string): Promise<string> {
  const mod = (await import("mjml-browser")) as unknown as {
    default: unknown;
  };
  type Mjml2Html = (
    mjml: string,
    options?: { validationLevel?: "strict" | "soft" | "skip" },
  ) => Promise<{
    html: string;
    errors: { formattedMessage?: string; message: string }[];
  }>;
  const mjml2html: Mjml2Html =
    typeof mod.default === "function"
      ? (mod.default as Mjml2Html)
      : ((mod.default as { default: Mjml2Html }).default as Mjml2Html);
  const result = await mjml2html(mjml, { validationLevel: "soft" });
  lastMjmlWarnings = (result.errors ?? []).map(
    (e) => e.formattedMessage ?? e.message,
  );
  return result.html ?? "";
}
