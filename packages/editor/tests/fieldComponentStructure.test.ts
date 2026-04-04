import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readComponent(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

const fieldDir = "components/toolbar/fields";

const allFieldFiles = [
  "TextField.vue",
  "TextareaField.vue",
  "ColorField.vue",
  "ImageField.vue",
  "NumberField.vue",
  "SelectField.vue",
  "BooleanField.vue",
  "RepeatableField.vue",
];

describe("TextField.vue structure", () => {
  const src = readComponent(`${fieldDir}/TextField.vue`);

  it("imports MergeTagInput", () => {
    expect(src).toContain('import MergeTagInput from "../../MergeTagInput.vue"');
  });

  it("uses MergeTagInput in template", () => {
    expect(src).toMatch(/<MergeTagInput/);
  });

  it("uses v-if readOnly on plain input", () => {
    expect(src).toMatch(/v-if="readOnly"/);
    expect(src).toMatch(/<input/);
  });

  it("passes model-value to MergeTagInput", () => {
    expect(src).toMatch(/:model-value="modelValue"/);
  });

  it("passes placeholder to MergeTagInput", () => {
    expect(src).toMatch(/:placeholder="field\.placeholder"/);
  });

  it("forwards update:model-value from MergeTagInput", () => {
    expect(src).toMatch(/@update:model-value="emit\('update:modelValue'/);
  });
});

describe("TextareaField.vue structure", () => {
  const src = readComponent(`${fieldDir}/TextareaField.vue`);

  it("imports MergeTagTextarea", () => {
    expect(src).toContain(
      'import MergeTagTextarea from "../../MergeTagTextarea.vue"',
    );
  });

  it("uses MergeTagTextarea in template", () => {
    expect(src).toMatch(/<MergeTagTextarea/);
  });

  it("uses v-if readOnly on plain textarea", () => {
    expect(src).toMatch(/v-if="readOnly"/);
    expect(src).toMatch(/<textarea/);
  });
});

describe("MergeTagInput.vue structure", () => {
  const src = readComponent("components/MergeTagInput.vue");

  it("imports useMergeTag composable", () => {
    expect(src).toContain("useMergeTag");
  });

  it("has segments computed property", () => {
    expect(src).toMatch(/const segments = computed/);
  });

  it("has hasMergeTags computed property", () => {
    expect(src).toMatch(/const hasMergeTags = computed/);
  });

  it("has insertMergeTag function", () => {
    expect(src).toMatch(/async function insertMergeTag/);
  });

  it("displays merge tag segments", () => {
    expect(src).toContain("seg.type === 'mergeTag'");
  });
});

describe("MergeTagTextarea.vue structure", () => {
  const src = readComponent("components/MergeTagTextarea.vue");

  it("imports useMergeTag composable", () => {
    expect(src).toContain("useMergeTag");
  });

  it("has segments computed property", () => {
    expect(src).toMatch(/const segments = computed/);
  });

  it("has hasMergeTags computed property", () => {
    expect(src).toMatch(/const hasMergeTags = computed/);
  });

  it("has insertMergeTag function", () => {
    expect(src).toMatch(/async function insertMergeTag/);
  });

  it("displays merge tag segments", () => {
    expect(src).toContain("seg.type === 'mergeTag'");
  });
});

describe("all field components", () => {
  for (const file of allFieldFiles) {
    describe(file, () => {
      const src = readComponent(`${fieldDir}/${file}`);

      it("has readOnly in props", () => {
        expect(src).toMatch(/readOnly\??:/);
      });

      it("has required field indicator with danger color", () => {
        expect(src).toContain("field.required");
        expect(src).toContain("tpl:text-[var(--tpl-danger)]");
      });

      it("emits update:modelValue", () => {
        expect(src).toContain("update:modelValue");
      });
    });
  }
});

describe("RepeatableField.vue v-for key", () => {
  const src = readComponent(`${fieldDir}/RepeatableField.vue`);

  it("uses field.key-based key instead of bare index", () => {
    expect(src).toContain(':key="`${field.key}-${index}`"');
    expect(src).not.toMatch(/:key="index"/);
  });
});
