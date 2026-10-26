import { expect, it } from "vitest";
import {
  runTranslationConformance as run,
  createMockTranslationProvider as mock,
} from "../src/testing";

it("passes the mock and exercises placeholders, allowed HTML, partial output, limits and abort", async () => {
  const checks = await run(mock());
  expect(checks.filter((check) => !check.ok)).toEqual([]);
  expect(checks.map((check) => check.name)).toEqual([
    "placeholders round-trip",
    "HTML stays within the allow-list",
    "a partial result is accepted",
    "51 fields are rejected or translated in full",
    "an aborted signal rejects with AbortError",
  ]);
});
it("detects missing attribute placeholders", async () => {
  const provider = mock();
  const checks = await run({
    translate: async (request, signal) => {
      const result = await provider.translate(request, signal);
      return {
        fields: result.fields.map((field) => ({
          ...field,
          text: field.text.replace(/__x\d+__/g, ""),
        })),
      };
    },
  });
  expect(
    checks.find((check) => check.name === "placeholders round-trip"),
  ).toMatchObject({ ok: false });
});
it("detects HTML outside the allow-list", async () => {
  const provider = mock();
  const checks = await run({
    translate: async (request, signal) => {
      const result = await provider.translate(request, signal);
      return {
        fields: result.fields.map((field) => ({
          ...field,
          text: `<script>bad()</script>${field.text}`,
        })),
      };
    },
  });
  expect(
    checks.find((check) => check.name === "HTML stays within the allow-list"),
  ).toMatchObject({ ok: false });
});
it("accepts partial output on its partial-result probe and a coded content limit", async () => {
  const provider = mock();
  const checks = await run({
    translate: async (request, signal) => {
      signal.throwIfAborted();
      if (request.fields.length === 51)
        throw Object.assign(new Error("Smaller batch"), {
          code: "content_too_large",
        });
      const result = await provider.translate(request, signal);
      return request.fields.some((field) => field.id === "partial-a")
        ? { fields: result.fields.slice(0, 1) }
        : result;
    },
  });
  expect(checks.filter((check) => !check.ok)).toEqual([]);
});
it("rejects truncation of 51 fields and a provider that ignores abort", async () => {
  const checks = await run({
    translate: async (request) => ({
      fields: request.fields.slice(0, 50).map(({ id, text }) => ({ id, text })),
    }),
  });
  expect(
    checks.find(
      (check) => check.name === "51 fields are rejected or translated in full",
    ),
  ).toMatchObject({ ok: false });
  expect(
    checks.find(
      (check) => check.name === "an aborted signal rejects with AbortError",
    ),
  ).toMatchObject({ ok: false });
});
it("reports malformed output as failed checks and uses the configured target locale", async () => {
  const targets: string[] = [];
  const provider = mock();
  const checks = await run(
    {
      translate: (request, signal) => {
        targets.push(request.targetLocale);
        return provider.translate(request, signal);
      },
    },
    { locale: "pt-BR" },
  );
  expect(checks.every((check) => check.ok)).toBe(true);
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every((locale) => locale === "pt-BR")).toBe(true);
  const malformed = await run({ translate: async () => null as never });
  expect(malformed.every((check) => !check.ok)).toBe(true);
});
