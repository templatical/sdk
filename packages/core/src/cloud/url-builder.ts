export function buildUrl(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    encodeURIComponent(params[key] ?? ""),
  );
}

const BASE = "/api/v1/projects/{project}/tenants/{tenant}";
const TEMPLATE = `${BASE}/templates/{template}`;
const AI = `${TEMPLATE}/ai`;
const MEDIA = `${BASE}/media`;
const FOLDERS = `${MEDIA}/folders`;
const MODULES = `${BASE}/saved-modules`;

export const API_ROUTES = {
  health: "/api/v1/health",
  "projects.config": `${BASE}/config`,
  "broadcasting.auth": `${BASE}/broadcasting/auth`,
  "templates.store": `${BASE}/templates`,
  "templates.show": `${TEMPLATE}`,
  "templates.update": `${TEMPLATE}`,
  "templates.destroy": `${TEMPLATE}`,
  "templates.export": `${TEMPLATE}/export`,
  "templates.importFromBeefree": `${BASE}/templates/import/from-beefree`,
  "templates.sendTestEmail": `${TEMPLATE}/send-test-email`,
  "snapshots.index": `${TEMPLATE}/snapshots`,
  "snapshots.store": `${TEMPLATE}/snapshots`,
  "snapshots.show": `${TEMPLATE}/snapshots/{snapshot}`,
  "snapshots.restore": `${TEMPLATE}/snapshots/{snapshot}/restore`,
  "comments.index": `${TEMPLATE}/comments`,
  "comments.store": `${TEMPLATE}/comments`,
  "comments.update": `${TEMPLATE}/comments/{comment}`,
  "comments.destroy": `${TEMPLATE}/comments/{comment}`,
  "comments.resolve": `${TEMPLATE}/comments/{comment}/resolve`,
  "ai.generate": `${AI}/generate`,
  "ai.conversationMessages": `${AI}/conversation-messages`,
  "ai.suggestions": `${AI}/suggestions`,
  "ai.rewriteText": `${AI}/rewrite-text`,
  "ai.score": `${AI}/score`,
  "ai.fixFinding": `${AI}/fix-finding`,
  "ai.generateFromDesign": `${AI}/generate-from-design`,
  "media.upload": `${MEDIA}/upload`,
  "media.browse": `${MEDIA}/browse`,
  "media.delete": `${MEDIA}/delete`,
  "media.move": `${MEDIA}/move`,
  "media.update": `${MEDIA}/{media}`,
  "media.replace": `${MEDIA}/{media}/replace`,
  "media.checkUsage": `${MEDIA}/check-usage`,
  "media.frequentlyUsed": `${MEDIA}/frequently-used`,
  "media.importFromUrl": `${MEDIA}/import-from-url`,
  "folders.index": `${FOLDERS}`,
  "folders.store": `${FOLDERS}`,
  "folders.update": `${FOLDERS}/{mediaFolder}`,
  "folders.destroy": `${FOLDERS}/{mediaFolder}`,
  "savedModules.index": `${MODULES}`,
  "savedModules.store": `${MODULES}`,
  "savedModules.update": `${MODULES}/{savedModule}`,
  "savedModules.destroy": `${MODULES}/{savedModule}`,
} as const;
