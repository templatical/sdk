import type { TemplateContent } from "@templatical/types";

export const SHARE_NOT_FOUND = "SHARE_NOT_FOUND";
export const SHARE_LOAD_FAILED = "SHARE_LOAD_FAILED";

export class ShareError extends Error {
  readonly code: "not-found" | "error";

  constructor(code: "not-found" | "error") {
    super(code);
    this.name = "ShareError";
    this.code = code;
  }
}

export interface ShareRecord {
  id: string;
  content: TemplateContent;
  sceneId?: string;
  createdAt: string;
}

const cache = new Map<string, ShareRecord>();

export function peekShare(id: string): ShareRecord | undefined {
  return cache.get(id);
}

export function clearShareCache(): void {
  cache.clear();
}

export async function fetchShare(id: string): Promise<ShareRecord> {
  const cached = cache.get(id);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(`/api/shares/${encodeURIComponent(id)}`);
  } catch {
    throw new ShareError("error");
  }

  if (res.status === 404) throw new ShareError("not-found");
  if (!res.ok) throw new ShareError("error");

  const data = (await res.json()) as ShareRecord;
  if (!data?.content || !Array.isArray(data.content.blocks)) {
    throw new ShareError("error");
  }
  cache.set(id, data);
  return data;
}

export async function createShare(
  content: TemplateContent,
  sceneId: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, sceneId }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<{ id: string; url: string }>;
}
