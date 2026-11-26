declare module "gifenc" {
  interface GifEncoder {
    writeFrame(
      pixels: Uint8Array,
      width: number,
      height: number,
      options: {
        palette: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  const gifenc: {
    GIFEncoder(): GifEncoder;
    quantize(
      pixels: Uint8Array | Uint8ClampedArray,
      maxColors: number,
    ): number[][];
    applyPalette(
      pixels: Uint8Array | Uint8ClampedArray,
      palette: number[][],
    ): Uint8Array;
  };
  export default gifenc;
}
