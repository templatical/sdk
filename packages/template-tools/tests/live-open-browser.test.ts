import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { openBrowser } from "../src/live/index";

vi.mock("node:child_process", () => ({ spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })) }));

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("openBrowser", () => {
  it.each([
    ["win32", "rundll32.exe", ["url.dll,FileProtocolHandler", "http://localhost:1/&calc"]],
    ["darwin", "open", ["https://example.com/"]],
    ["linux", "xdg-open", ["https://example.com/"]],
  ] as const)("opens an HTTP URL on %s without a shell", (platform, command, args) => {
    vi.spyOn(process, "platform", "get").mockReturnValue(platform);
    openBrowser(platform === "win32" ? "http://localhost:1/&calc" : "https://example.com");
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(command, args, { stdio: "ignore", detached: true });
  });

  it("ignores a spawn that throws", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    vi.mocked(spawn).mockImplementationOnce(() => { throw new Error("ENOENT"); });
    expect(() => openBrowser("https://example.com")).not.toThrow();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("handles the child's error event and detaches it", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    const child = { on: vi.fn(), unref: vi.fn() };
    vi.mocked(spawn).mockReturnValueOnce(child as never);
    openBrowser("https://example.com");
    expect(child.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(child.unref).toHaveBeenCalledTimes(1);
    expect(() => child.on.mock.calls[0][1](new Error("no browser"))).not.toThrow();
  });

  it.each(["file:///etc/passwd", "javascript:alert(1)", "not a URL"])("ignores %s", (url) => {
    openBrowser(url);
    expect(spawn).not.toHaveBeenCalled();
  });
});
