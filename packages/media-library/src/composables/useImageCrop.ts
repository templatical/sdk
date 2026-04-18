export type AspectRatioPreset =
  | "free"
  | "square"
  | "landscape43"
  | "landscape169"
  | "original";

export interface AspectRatioOption {
  key: AspectRatioPreset;
  value: number | undefined;
}

export const ASPECT_RATIO_VALUES: Record<
  AspectRatioPreset,
  number | undefined
> = {
  free: undefined,
  square: 1,
  landscape43: 4 / 3,
  landscape169: 16 / 9,
  original: undefined,
};

export interface ExportSettings {
  mimeType: string;
  quality: number;
}

export function getExportSettings(originalMimeType: string): ExportSettings {
  if (originalMimeType === "image/png") {
    return { mimeType: "image/png", quality: 1 };
  }
  if (originalMimeType === "image/gif") {
    return { mimeType: "image/png", quality: 1 };
  }
  if (originalMimeType === "image/webp") {
    return { mimeType: "image/webp", quality: 0.92 };
  }

  return { mimeType: "image/jpeg", quality: 0.92 };
}

export function resizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  maxWidth?: number,
  maxHeight?: number,
): HTMLCanvasElement {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;

  if (!maxWidth && !maxHeight) {
    return sourceCanvas;
  }

  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (maxWidth && sourceWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round(sourceHeight * (maxWidth / sourceWidth));
  }

  if (maxHeight && targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = Math.round(
      targetWidth *
        (maxHeight / (sourceHeight * (maxWidth ? maxWidth / sourceWidth : 1))),
    );
  }

  if (targetWidth === sourceWidth && targetHeight === sourceHeight) {
    return sourceCanvas;
  }

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = targetWidth;
  resizedCanvas.height = targetHeight;

  const ctx = resizedCanvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  }

  return resizedCanvas;
}

export function canvasToFile(
  canvas: HTMLCanvasElement,
  filename: string,
  settings: ExportSettings,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob from canvas"));
          return;
        }

        const extension = settings.mimeType.split("/")[1];
        const baseFilename = filename.replace(/\.[^.]+$/, "");
        const finalFilename = `${baseFilename}.${extension}`;

        const file = new File([blob], finalFilename, {
          type: settings.mimeType,
        });
        resolve(file);
      },
      settings.mimeType,
      settings.quality,
    );
  });
}

export function calculateOutputDimensions(
  cropWidth: number,
  cropHeight: number,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  let width = cropWidth;
  let height = cropHeight;

  if (maxWidth && width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  if (maxHeight && height > maxHeight) {
    const ratio = maxHeight / height;
    height = maxHeight;
    width = Math.round(width * ratio);
  }

  return { width, height };
}
