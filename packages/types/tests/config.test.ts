import { describe, expect, it } from "vitest";
import { SdkError } from "../src/config";

describe("SdkError", () => {
  describe("constructor", () => {
    it("sets message and statusCode", () => {
      const error = new SdkError("Not found", 404);
      expect(error.message).toBe("Not found");
      expect(error.statusCode).toBe(404);
    });

    it("defaults statusCode to undefined when not provided", () => {
      const error = new SdkError("Something failed");
      expect(error.message).toBe("Something failed");
      expect(error.statusCode).toBeUndefined();
    });

    it("sets code from the third argument", () => {
      const error = new SdkError("Storage is full.", 403, "limit_reached");
      expect(error.code).toBe("limit_reached");
      expect(error.statusCode).toBe(403);
    });

    it("keeps a code the known list does not name", () => {
      const error = new SdkError("Later.", 403, "user_required");
      expect(error.code).toBe("user_required");
    });

    it("defaults code to undefined when not provided", () => {
      expect(new SdkError("Invalid.", 422).code).toBeUndefined();
    });

    it('sets name to "SdkError"', () => {
      const error = new SdkError("test");
      expect(error.name).toBe("SdkError");
    });

    it("is instanceof Error", () => {
      const error = new SdkError("test", 500);
      expect(error).toBeInstanceOf(Error);
    });

    it("has a stack trace", () => {
      const error = new SdkError("test");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("SdkError");
    });
  });

  describe("isNotFound", () => {
    it("returns true for 404", () => {
      expect(new SdkError("nf", 404).isNotFound).toBe(true);
    });

    it("returns false for non-404 status codes", () => {
      expect(new SdkError("", 401).isNotFound).toBe(false);
      expect(new SdkError("", 500).isNotFound).toBe(false);
      expect(new SdkError("", 200).isNotFound).toBe(false);
    });

    it("returns false when statusCode is undefined", () => {
      expect(new SdkError("").isNotFound).toBe(false);
    });
  });

  describe("isUnauthorized", () => {
    it("returns true for 401", () => {
      expect(new SdkError("unauth", 401).isUnauthorized).toBe(true);
    });

    it("returns false for non-401 status codes", () => {
      expect(new SdkError("", 404).isUnauthorized).toBe(false);
      expect(new SdkError("", 500).isUnauthorized).toBe(false);
      expect(new SdkError("", 403).isUnauthorized).toBe(false);
    });

    it("returns false when statusCode is undefined", () => {
      expect(new SdkError("").isUnauthorized).toBe(false);
    });
  });

  describe("isServerError", () => {
    it("returns true for 500", () => {
      expect(new SdkError("", 500).isServerError).toBe(true);
    });

    it("returns true for 503", () => {
      expect(new SdkError("", 503).isServerError).toBe(true);
    });

    it("returns false for 499 (boundary)", () => {
      expect(new SdkError("", 499).isServerError).toBe(false);
    });

    it("returns false for client errors", () => {
      expect(new SdkError("", 400).isServerError).toBe(false);
      expect(new SdkError("", 404).isServerError).toBe(false);
    });

    it("returns false when statusCode is undefined", () => {
      expect(new SdkError("").isServerError).toBe(false);
    });
  });
});
