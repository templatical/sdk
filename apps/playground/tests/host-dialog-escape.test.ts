import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HOST_DIR = join(__dirname, "../src/host");

/**
 * A host dialog closes on Escape in a capture-phase handler, and closing tears
 * its focus trap down before focus-trap's own Escape handler runs. So the
 * dialog must mark the Escape handled itself: the import paste panel ignores a
 * handled Escape, and would otherwise close on the same press and lose what
 * was pasted.
 */
const handlers = readdirSync(HOST_DIR)
  .filter((file) => file.endsWith(".vue"))
  .flatMap((file) =>
    [
      ...readFileSync(join(HOST_DIR, file), "utf8").matchAll(
        /@keydown\.escape[.\w]*=/g,
      ),
    ].map((match) => ({ file, directive: match[0] })),
  );

describe("host dialog Escape handlers", () => {
  it("covers every host dialog that closes on Escape", () => {
    expect(handlers.map((handler) => handler.file).sort()).toEqual([
      "CodeDrawer.vue",
      "DataSourcePicker.vue",
      "ExportModal.vue",
      "HostKnobs.vue",
      "ShareModal.vue",
    ]);
  });

  it.each(handlers.map((handler) => [handler.file, handler.directive]))(
    "%s marks its Escape handled",
    (_file, directive) => {
      expect(directive).toBe("@keydown.escape.capture.prevent=");
    },
  );
});
