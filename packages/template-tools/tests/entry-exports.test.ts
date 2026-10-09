import { expect, it } from "vitest";
import * as entry from "../src/index";

// The package entry is a public API: a module re-exported wholesale would
// publish every internal helper next to it.
it("exports exactly the documented runtime API", () => {
  expect(Object.keys(entry).sort()).toEqual([
    "SPECIMEN_STATES",
    "applyOperation",
    "checkCustomBlock",
    "getColumnCount",
    "runQualityLint",
    "schema",
    "validateCustomBlockDefinition",
    "validateTemplate",
  ]);
});
