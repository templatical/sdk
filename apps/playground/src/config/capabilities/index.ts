import type { AnyCapabilityDef } from "../types";
import { savedBlocksCapability } from "./saved-blocks";
import { templatesCapability } from "./templates";
import { versionHistoryCapability } from "./version-history";
import { commentsCapability } from "./comments";

export const capabilities: AnyCapabilityDef[] = [
  savedBlocksCapability,
  templatesCapability,
  versionHistoryCapability,
  commentsCapability,
];

export function capabilityById(id: string): AnyCapabilityDef | undefined {
  return capabilities.find((c) => c.id === id);
}
