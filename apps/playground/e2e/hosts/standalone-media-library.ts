import { init } from "@templatical/media-library";
import type {
  MediaAsset,
  MediaFolder,
  MediaProvider,
} from "@templatical/types";

/**
 * Mounts the standalone media library with an in-memory provider that enables
 * every feature, so each dialog and the folder tree can open. Sets
 * `window.__mediaReady` once the first page of assets has rendered.
 */

const swatch = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="${color}"/></svg>`,
  )}`;

const assets: MediaAsset[] = ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f"].map(
  (color, i) => ({
    id: `asset-${i + 1}`,
    url: swatch(color),
    filename: `campaign-photo-${i + 1}.png`,
    mimeType: "image/png",
    width: 1200,
    height: 800,
    size: 150_000 + i * 30_000,
    folderId: null,
    createdAt: "2026-10-01T10:00:00Z",
  }),
);

// A nested folder, so the tree renders an expand chevron.
const folders: MediaFolder[] = [
  { id: "campaigns", name: "Campaigns", parentId: null },
  { id: "summer", name: "Summer", parentId: "campaigns" },
  { id: "logos", name: "Logos", parentId: null },
];

const byId = (id: string) => assets.find((asset) => asset.id === id)!;

const provider: MediaProvider = {
  list: async (params = {}) => ({
    items: params.search
      ? assets.filter((asset) => asset.filename?.includes(params.search!))
      : assets,
  }),
  create: async ({ file }) => ({
    ...assets[0],
    id: "new",
    filename: file.name,
  }),
  update: async (id, patch) => ({ ...byId(id), ...patch }),
  delete: async () => {},
  folders: {
    list: async () => folders,
    create: async (input) => ({ id: "created", ...input }),
    update: async (id, patch) => ({
      ...folders.find((folder) => folder.id === id)!,
      ...patch,
    }),
    delete: async () => {},
    move: async (ids, folderId) => ids.map((id) => ({ ...byId(id), folderId })),
  },
  replace: async (id, file) => ({ ...byId(id), filename: file.name }),
  importFromUrl: async (url) => ({ ...assets[1], id: "imported", url }),
  // Every asset is in use, so the delete and replace warnings list usage.
  checkUsage: async (ids) =>
    Object.fromEntries(
      ids.map((id) => [id, { templateCount: 2, templateNames: ["A", "B"] }]),
    ),
  frequentlyUsed: async () => assets.slice(0, 2),
  storage: async () => ({ usedBytes: 300_000_000, limitBytes: 1_000_000_000 }),
};

await init({
  container: "#media",
  provider,
  onSelect: () => {},
});

(window as unknown as { __mediaReady: boolean }).__mediaReady = true;
