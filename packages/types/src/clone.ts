/**
 * Cycle-safe deep clone via a JSON round-trip.
 *
 * A naked `JSON.stringify` throws `Converting circular structure to JSON`
 * if the tree is self-referencing — e.g. a DOM element carrying a Sortable
 * expando back-ref (`HTMLDivElement.SortableXXX -> instance -> el -> div`)
 * leaks into block data through a drag handler inside a section. Both the
 * editor's public `getContent()` export path and the history snapshot path
 * must tolerate that: we drop the offending back-ref from the clone rather
 * than throw. Losing a transient DOM expando is harmless; the block data is
 * intact.
 *
 * The `WeakSet` replacer omits any object already seen on the current path,
 * which covers every cyclic shape. Template content is tree-shaped (and is
 * serialized to JSON for storage anyway), so dropping repeated references
 * never costs real data.
 */
export function safeClone<T>(value: T): T {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return undefined;
        seen.add(val);
      }
      return val;
    }),
  ) as T;
}
