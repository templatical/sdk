import { isRef } from "@vue/reactivity";
import {
  assertNoSlotInContent,
  assertNoWrapperInContent,
  getColumnCount,
  type Block,
  type TemplateContent,
} from "@templatical/types";

type MutationGuard = (method: string, args: unknown[]) => boolean;
type StructuralMutation =
  "addBlock" | "removeBlock" | "moveBlock" | "duplicateBlock";

interface Location {
  targetSectionId?: string;
  columnIndex?: number;
  index: number;
}

export interface StructuralMutationContext {
  canEdit?: () => boolean;
  content?: () => TemplateContent;
  findBlock?: (id: string) => Block | null;
  findBlockLocation?: (id: string) => Location | null;
  isBlockLocked: (id: string, structure?: boolean) => boolean;
}

export function isStructuralMutation(
  method: string,
): method is StructuralMutation {
  return ["addBlock", "removeBlock", "moveBlock", "duplicateBlock"].includes(
    method,
  );
}

/** The eligibility shared by structural actions and their history preflight. */
export function canEditStructure(
  context: StructuralMutationContext,
  method: StructuralMutation,
  args: unknown[],
): boolean {
  if (context.canEdit && !context.canEdit()) return false;
  const adding = method === "addBlock";
  const duplicating = method === "duplicateBlock";
  const id = typeof args[0] === "string" ? args[0] : (args[0] as Block).id;
  const block = adding ? (args[0] as Block) : context.findBlock?.(id);
  if (!adding && context.findBlock && !block) return false;
  const source = adding ? null : context.findBlockLocation?.(id);
  if (!adding && context.findBlockLocation && !source) return false;
  if (!adding && context.isBlockLocked(id, true)) return false;
  if (
    source?.targetSectionId &&
    context.isBlockLocked(source.targetSectionId, true)
  )
    return false;
  if (adding && context.content) {
    const candidate = { ...context.content(), blocks: [block!] };
    assertNoSlotInContent(candidate);
    assertNoWrapperInContent(candidate);
  }
  if (method === "removeBlock") return true;
  const implicitDuplicate =
    duplicating && args[1] === undefined && args[2] === undefined;
  const sectionId = (
    implicitDuplicate
      ? source?.targetSectionId
      : args[method === "moveBlock" ? 2 : 1]
  ) as string | undefined;
  const columnIndex =
    ((implicitDuplicate
      ? source?.columnIndex
      : args[method === "moveBlock" ? 3 : 2]) as number | undefined) ?? 0;
  if (sectionId) {
    if (context.isBlockLocked(sectionId, true) || block?.type === "section")
      return false;
    if (context.findBlock) {
      const section = context.findBlock(sectionId);
      if (
        section?.type !== "section" ||
        columnIndex < 0 ||
        columnIndex >= getColumnCount(section.columns)
      )
        return false;
    }
  }
  if (
    method === "moveBlock" &&
    source?.targetSectionId === sectionId &&
    (source?.columnIndex ?? 0) === columnIndex &&
    source?.index === args[1]
  )
    return false;
  return true;
}

// Internal metadata avoids adding a public eligibility method to the SDK.
const guards = new WeakMap<object, MutationGuard>();

export function registerMutationGuard(
  editor: object,
  guard: MutationGuard,
): void {
  guards.set(editor, guard);
  for (const value of Object.values(editor))
    if (typeof value === "function") guards.set(value, guard);
}

export function inheritMutationGuard(source: object, target: object): void {
  const guard = guards.get(source);
  if (guard) guards.set(target, guard);
}

export function canMutate(
  editor: object,
  method: string,
  args: unknown[],
): boolean {
  const ownMethod: unknown = Reflect.get(editor, method);
  const guard =
    guards.get(editor) ??
    (typeof ownMethod === "function" ? guards.get(ownMethod) : undefined);
  if (guard) return guard(method, args);
  if (!isStructuralMutation(method)) return true;
  const isBlockLocked: unknown = Reflect.get(editor, "isBlockLocked");
  if (typeof isBlockLocked !== "function") return true;

  // Adapters expose Ref content; the structural context consumes a getter.
  const context: StructuralMutationContext = {
    isBlockLocked: (id, structure) => isBlockLocked.call(editor, id, structure),
  };
  const content: unknown = Reflect.get(editor, "content");
  if (isRef<TemplateContent>(content)) context.content = () => content.value;
  else if (typeof content === "function")
    context.content = () => content.call(editor);
  for (const key of ["canEdit", "findBlock", "findBlockLocation"] as const) {
    const member: unknown = Reflect.get(editor, key);
    if (typeof member === "function") context[key] = member.bind(editor);
  }
  return canEditStructure(context, method, args);
}
