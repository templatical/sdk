import type { AnyCapabilityDef } from "../types";
import { savedBlocksCapability } from "./saved-blocks";
import { templatesCapability } from "./templates";

export const capabilities: AnyCapabilityDef[] = [
  savedBlocksCapability,
  templatesCapability,
];

export function capabilityById(id: string): AnyCapabilityDef | undefined {
  return capabilities.find((c) => c.id === id);
}
