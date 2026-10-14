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
 * The replacer tracks the ancestors of the value it is serializing and omits
 * only a reference back to one of them, which is what every cycle is. An
 * object reached by two paths is not a cycle and is copied into each place:
 * content can legitimately share one, e.g. the repeatable `default` array that
 * `createCustomBlock` hands every block of a type, and dropping the second
 * visit would lose that block's data from `getContent()` and undo.
 */
export function safeClone<T>(value: T): T {
  const ancestors: object[] = [];
  return JSON.parse(
    JSON.stringify(value, function (this: unknown, _key, val) {
      if (typeof val !== "object" || val === null) return val;
      // `this` is the object holding `val`; anything above it on the stack
      // belongs to a branch serialization has already left.
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop();
      }
      if (ancestors.includes(val)) return undefined;
      ancestors.push(val);
      return val;
    }),
  ) as T;
}
