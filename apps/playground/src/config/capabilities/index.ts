import type { AnyCapabilityDef } from "../types";
import { savedBlocksCapability } from "./saved-blocks";

export const capabilities: AnyCapabilityDef[] = [savedBlocksCapability];

export function capabilityById(id: string): AnyCapabilityDef | undefined {
  return capabilities.find((c) => c.id === id);
}
