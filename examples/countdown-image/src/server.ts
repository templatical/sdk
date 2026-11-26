import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import {
  COUNTDOWN_BLOCK_DEFAULTS,
  countdownTargetTime,
} from "@templatical/types";
import type { CountdownBlock } from "@templatical/types";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const FONT = "Countdown Sans";
const fontPath = fileURLToPath(
  new URL("../assets/NotoSansJP-subset.ttf", import.meta.url),
);
if (!GlobalFonts.registerFromPath(fontPath, FONT)) {
  throw new Error(`Cannot load bundled font: ${fontPath}`);
}

const MAX_QUERY_LENGTH = 2048;
const MAX_LABEL_LENGTH = 32;
const MAX_MESSAGE_LENGTH = 100;
const MAX_CANVAS_WIDTH = 1200;
const MAX_CANVAS_HEIGHT = 160;
const FRAME_COUNT = 60;
const FRAME_DELAY = 1000;
const PAD = 12;
const GAP = 8;
const MAX_TARGET = Date.UTC(2101, 0, 1);
const MIN_TARGET = Date.UTC(2000, 0, 1);

class ValidationError extends Error {}

type Fields = Pick<
  CountdownBlock,
  | "targetDate"
  | "timezone"
  | "showDays"
  | "showHours"
  | "showMinutes"
  | "showSeconds"
  | "labelDays"
  | "labelHours"
  | "labelMinutes"
  | "labelSeconds"
  | "separator"
  | "digitColor"
  | "labelColor"
  | "backgroundColor"
  | "digitFontSize"
  | "labelFontSize"
  | "expiredMessage"
  | "hideOnExpiry"
>;
const defaults = COUNTDOWN_BLOCK_DEFAULTS as Fields;

function readFields(params: URLSearchParams): {
  fields: Fields;
  target: number;
} {
  const value = (name: keyof Fields, fallback: string) =>
    params.get(name) ?? fallback;
  const bounded = (name: keyof Fields, fallback: string, max: number) => {
    const text = value(name, fallback);
    if (text.length > max) throw new ValidationError(`${name} is too long`);
    return text;
  };
  const boolean = (name: keyof Fields, fallback: boolean) => {
    const text = value(name, String(fallback));
    if (text !== "true" && text !== "false")
      throw new ValidationError(`Invalid ${name}`);
    return text === "true";
  };
  const size = (
    name: keyof Fields,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const raw = value(name, String(fallback));
    if (!/^\d+(?:\.\d+)?$/.test(raw))
      throw new ValidationError(`Invalid ${name}`);
    return Math.max(min, Math.min(max, Number(raw)));
  };
  const color = (name: keyof Fields, fallback: string) => {
    const text = value(name, fallback);
    if (!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(text))
      throw new ValidationError(`Invalid ${name}`);
    return text;
  };
  const targetDate = bounded("targetDate", defaults.targetDate, 40);
  const timezone = bounded("timezone", defaults.timezone, 64);
  const target = countdownTargetTime({ targetDate, timezone });
  if (target === null || target < MIN_TARGET || target >= MAX_TARGET)
    throw new ValidationError("Invalid targetDate or timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new ValidationError("Invalid timezone");
  }
  const separator = value("separator", defaults.separator);
  if (separator !== ":" && separator !== "-" && separator !== " ")
    throw new ValidationError("Invalid separator");
  return {
    target,
    fields: {
      targetDate,
      timezone,
      showDays: boolean("showDays", defaults.showDays),
      showHours: boolean("showHours", defaults.showHours),
      showMinutes: boolean("showMinutes", defaults.showMinutes),
      showSeconds: boolean("showSeconds", defaults.showSeconds),
      labelDays: bounded("labelDays", defaults.labelDays, MAX_LABEL_LENGTH),
      labelHours: bounded("labelHours", defaults.labelHours, MAX_LABEL_LENGTH),
      labelMinutes: bounded(
        "labelMinutes",
        defaults.labelMinutes,
        MAX_LABEL_LENGTH,
      ),
      labelSeconds: bounded(
        "labelSeconds",
        defaults.labelSeconds,
        MAX_LABEL_LENGTH,
      ),
      separator,
      digitColor: color("digitColor", defaults.digitColor),
      labelColor: color("labelColor", defaults.labelColor),
      backgroundColor: color("backgroundColor", defaults.backgroundColor),
      digitFontSize: size("digitFontSize", defaults.digitFontSize, 8, 72),
      labelFontSize: size("labelFontSize", defaults.labelFontSize, 8, 32),
      expiredMessage: bounded(
        "expiredMessage",
        defaults.expiredMessage,
        MAX_MESSAGE_LENGTH,
      ),
      hideOnExpiry: boolean("hideOnExpiry", defaults.hideOnExpiry),
    },
  };
}

function segments(fields: Fields, seconds: number) {
  const result: { digits: string; label: string }[] = [];
  if (fields.showDays)
    result.push({
      digits: String(Math.floor(seconds / 86400)),
      label: fields.labelDays,
    });
  if (fields.showHours)
    result.push({
      digits: String(
        Math.floor(seconds / 3600) % (fields.showDays ? 24 : Infinity),
      ).padStart(2, "0"),
      label: fields.labelHours,
    });
  if (fields.showMinutes)
    result.push({
      digits: String(
        Math.floor(seconds / 60) % (fields.showHours ? 60 : Infinity),
      ).padStart(2, "0"),
      label: fields.labelMinutes,
    });
  if (fields.showSeconds)
    result.push({
      digits: String(seconds % (fields.showMinutes ? 60 : Infinity)).padStart(
        2,
        "0",
      ),
      label: fields.labelSeconds,
    });
  return result;
}

function transparentGif(): Uint8Array {
  const gif = GIFEncoder();
  gif.writeFrame(new Uint8Array([0]), 1, 1, {
    palette: [
      [0, 0, 0],
      [255, 255, 255],
    ],
    transparent: true,
    transparentIndex: 0,
    repeat: -1,
  });
  gif.finish();
  return gif.bytes();
}

function renderGif(fields: Fields, target: number, now: number): Uint8Array {
  if (target <= now && fields.hideOnExpiry) return transparentGif();
  const expired = target <= now;
  const firstSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  const first = segments(fields, firstSeconds);
  const measuring = createCanvas(1, 1).getContext("2d");
  const digitFont = `${fields.digitFontSize}px "${FONT}"`;
  const labelFont = `${fields.labelFontSize}px "${FONT}"`;
  const measure = (text: string, font: string) => {
    measuring.font = font;
    return measuring.measureText(text).width;
  };
  const widths = first.map(
    ({ digits, label }) =>
      Math.ceil(
        Math.max(
          measure("8".repeat(digits.length), digitFont),
          measure(label, labelFont),
        ),
      ) + GAP,
  );
  const separatorWidth = Math.ceil(measure(fields.separator, digitFont)) + GAP;
  const rowWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, widths.length - 1) * separatorWidth;
  const messageWidth = Math.ceil(measure(fields.expiredMessage, digitFont));
  const width = Math.max(
    1,
    Math.ceil(
      (expired ? messageWidth : Math.max(rowWidth, messageWidth)) + PAD * 2,
    ),
  );
  const height = Math.ceil(
    (expired
      ? fields.digitFontSize
      : fields.digitFontSize + fields.labelFontSize + GAP) +
      PAD * 2,
  );
  if (width > MAX_CANVAS_WIDTH || height > MAX_CANVAS_HEIGHT)
    throw new ValidationError("Countdown image is too large");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const gif = GIFEncoder();
  const count = expired ? 1 : Math.min(FRAME_COUNT, firstSeconds + 1);

  for (let frame = 0; frame < count; frame++) {
    ctx.fillStyle = fields.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    const remaining = Math.max(
      0,
      Math.ceil((target - now - frame * FRAME_DELAY) / 1000),
    );
    if (remaining === 0) {
      ctx.fillStyle = fields.digitColor;
      ctx.font = digitFont;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(fields.expiredMessage, width / 2, height / 2);
    } else {
      const values = segments(fields, remaining);
      let x = (width - rowWidth) / 2;
      for (let index = 0; index < values.length; index++) {
        const segment = values[index];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = digitFont;
        ctx.fillStyle = fields.digitColor;
        ctx.fillText(
          segment.digits,
          x + widths[index] / 2,
          PAD + fields.digitFontSize / 2,
        );
        ctx.font = labelFont;
        ctx.fillStyle = fields.labelColor;
        ctx.fillText(
          segment.label,
          x + widths[index] / 2,
          PAD + fields.digitFontSize + GAP + fields.labelFontSize / 2,
        );
        x += widths[index];
        if (index < values.length - 1) {
          ctx.font = digitFont;
          ctx.fillStyle = fields.digitColor;
          ctx.fillText(
            fields.separator,
            x + separatorWidth / 2,
            PAD + fields.digitFontSize / 2,
          );
          x += separatorWidth;
        }
      }
    }
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const palette = quantize(pixels, 32);
    gif.writeFrame(applyPalette(pixels, palette), width, height, {
      palette,
      delay: FRAME_DELAY,
      repeat: -1,
    });
  }
  gif.finish();
  return gif.bytes();
}

const port = Number(process.env.PORT ?? 21746);
createServer((request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Countdown image endpoint\n");
    return;
  }
  if (request.url?.split("?", 1)[0] !== "/countdown.gif") {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    if (request.url.length > MAX_QUERY_LENGTH)
      throw new ValidationError("Query is too long");
    const url = new URL(request.url, "http://127.0.0.1");
    const { fields, target } = readFields(url.searchParams);
    const bytes = renderGif(fields, target, Date.now());
    response.writeHead(200, {
      "Content-Type": "image/gif",
      // A one-second public lifetime limits how far a newly opened image can lag.
      "Cache-Control": "public, max-age=1",
    });
    response.end(request.method === "HEAD" ? undefined : Buffer.from(bytes));
  } catch (error) {
    const validation = error instanceof ValidationError;
    response.writeHead(validation ? 400 : 500, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(
      request.method === "HEAD"
        ? undefined
        : validation
          ? `${error.message}\n`
          : "Internal server error\n",
    );
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Countdown image endpoint on http://127.0.0.1:${port}`);
});
