// Shared file IO and the error→exit-code contract.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export const EXIT = {
  ok: 0,
  /** Structural errors, or quality issues of severity "error". */
  invalid: 1,
  /** Bad flags, missing arguments, unreadable input. */
  usage: 2,
  /** An optional dependency is not installed; the message names the install. */
  missingDep: 3,
} as const;

export class UsageError extends Error {}

export class InvalidTemplateError extends Error {
  constructor(
    message: string,
    readonly errors: string[] = [],
  ) {
    super(message);
  }
}

export class MissingDependencyError extends Error {
  constructor(
    readonly pkg: string,
    message: string,
  ) {
    super(message);
  }
}

export function resolveFrom(file: string, cwd = process.cwd()): string {
  return isAbsolute(file) ? file : resolve(cwd, file);
}

export function readTemplateFile(file: string, cwd = process.cwd()): unknown {
  const path = resolveFrom(file, cwd);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`Could not read ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new UsageError(
      `${file} is not valid JSON: ${(err as Error).message}`,
    );
  }
}

/** Write a template, creating the parent directory. Returns the path written. */
export function writeTemplateFile(
  file: string,
  content: unknown,
  cwd = process.cwd(),
): string {
  const path = resolveFrom(file, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return path;
}
