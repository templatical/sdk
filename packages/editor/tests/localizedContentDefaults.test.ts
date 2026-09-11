import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_BLOCK_DEFAULTS,
  VIDEO_BLOCK_DEFAULTS,
} from "@templatical/types";
import {
  CONTENT_DEFAULT_LOCALES,
  localizedContentDefaults,
} from "../src/i18n/contentDefaults";

describe("localizedContentDefaults", () => {
  it("resolves the countdown unit labels for the given content locale", () => {
    const defaults = localizedContentDefaults("de");
    expect(defaults.countdown?.labelDays).toBe("Tage");
    expect(defaults.countdown?.labelHours).toBe("Stunden");
    expect(defaults.countdown?.labelMinutes).toBe("Minuten");
    expect(defaults.countdown?.labelSeconds).toBe("Sekunden");
  });

  it("resolves the expired message", () => {
    expect(localizedContentDefaults("fr").countdown?.expiredMessage).toBe(
      "Cette offre a expiré",
    );
  });

  it("resolves the video alt text", () => {
    expect(localizedContentDefaults("ca").video?.alt).toBe("Vídeo");
  });

  // Same invariant as localizedBlockDefaults: the English arm must not move.
  it("reproduces the English factory defaults verbatim", () => {
    const defaults = localizedContentDefaults("en");
    expect(defaults.video?.alt).toBe(VIDEO_BLOCK_DEFAULTS.alt);
    expect(defaults.countdown?.labelDays).toBe(
      COUNTDOWN_BLOCK_DEFAULTS.labelDays,
    );
    expect(defaults.countdown?.labelHours).toBe(
      COUNTDOWN_BLOCK_DEFAULTS.labelHours,
    );
    expect(defaults.countdown?.labelMinutes).toBe(
      COUNTDOWN_BLOCK_DEFAULTS.labelMinutes,
    );
    expect(defaults.countdown?.labelSeconds).toBe(
      COUNTDOWN_BLOCK_DEFAULTS.labelSeconds,
    );
    expect(defaults.countdown?.expiredMessage).toBe(
      COUNTDOWN_BLOCK_DEFAULTS.expiredMessage,
    );
  });

  // `settings.locale` is a BCP-47 tag the author types by hand, so it arrives
  // with regions, odd casing and underscores far more often than `config.locale`
  // does.
  it.each(["de-AT", "de_DE", "DE", "  de  "])(
    "strips region, case and whitespace to match the base language: %s",
    (tag) => {
      expect(localizedContentDefaults(tag).countdown?.labelDays).toBe("Tage");
    },
  );

  it("falls back to English for a locale it has no strings for", () => {
    expect(localizedContentDefaults("ja").countdown?.labelDays).toBe("Days");
  });

  it.each(["", "   ", "not a locale", "!!"])(
    "falls back to English for a malformed locale: %s",
    (tag) => {
      expect(localizedContentDefaults(tag).video?.alt).toBe("Video");
    },
  );

  it("falls back to English when the template carries no locale at all", () => {
    expect(localizedContentDefaults(undefined).video?.alt).toBe("Video");
  });

  // Only recipient-facing fields. An author-facing prompt appearing here would
  // mean it follows `settings.locale` rather than the editing UI's locale.
  it("touches only video and countdown", () => {
    expect(Object.keys(localizedContentDefaults("de")).sort()).toEqual([
      "countdown",
      "video",
    ]);
  });

  it("overrides no countdown field beyond the six text ones", () => {
    expect(
      Object.keys(localizedContentDefaults("de").countdown ?? {}).sort(),
    ).toEqual([
      "expiredMessage",
      "labelDays",
      "labelHours",
      "labelMinutes",
      "labelSeconds",
    ]);
  });

  it.each(CONTENT_DEFAULT_LOCALES)(
    "carries a complete, non-empty set for every registered locale: %s",
    (locale) => {
      const defaults = localizedContentDefaults(locale);
      const values = [
        defaults.video?.alt,
        defaults.countdown?.labelDays,
        defaults.countdown?.labelHours,
        defaults.countdown?.labelMinutes,
        defaults.countdown?.labelSeconds,
        defaults.countdown?.expiredMessage,
      ];
      for (const value of values) {
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    },
  );

  // The whole point of a separate table: it must cover the same locales the UI
  // bundles do, or a German editor gets German chrome and English countdowns.
  it("registers the same locale set as the OSS UI bundles", async () => {
    const { getSupportedLocales } = await import("../src/i18n");
    expect([...CONTENT_DEFAULT_LOCALES].sort()).toEqual(
      [...getSupportedLocales()].sort(),
    );
  });
});
