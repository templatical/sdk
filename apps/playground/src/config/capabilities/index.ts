import type { CapabilityDef } from "../types";
import { savedBlocksCapability } from "./saved-blocks";

export const capabilities: CapabilityDef[] = [savedBlocksCapability];

export function capabilityById(id: string): CapabilityDef | undefined {
  return capabilities.find((c) => c.id === id);
}
