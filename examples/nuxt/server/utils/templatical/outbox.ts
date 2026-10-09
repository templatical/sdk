// The one function to replace with a real email provider (Resend, SES, SMTP,
// and so on). It receives the finished HTML, so any provider that sends HTML
// fits. Until then, each message lands in data/outbox/ as an .html file you can
// open in a browser.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUTBOX_DIR = join(process.env.TEMPLATICAL_DATA_DIR ?? "./data", "outbox");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: unknown): value is string {
  // 254 characters is the longest address SMTP accepts, and the cap keeps the
  // pattern's backtracking bounded on hostile input.
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value);
}

export async function deliver(message: { to: string; subject: string; html: string }): Promise<void> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // File systems cap a name at 255 bytes, and an address can be 254 characters.
  const name = message.to.replace(/[^a-z0-9@._-]/gi, "_").slice(0, 100);
  const file = join(OUTBOX_DIR, `${stamp}-${name}.html`);
  await writeFile(file, message.html);
  console.log(`[outbox] "${message.subject}" to ${message.to}: ${file}`);
}
