/**
 * Grayscale processing shared by the CLI and the editor. Pixels are 8-bit, 0 = black.
 */

import { dither, threshold } from "./raster";

export type InkMode = "dither" | "threshold";

/** Slider values from -100 to 100, where 0 leaves the image unchanged. */
export type Adjustments = { brightness: number; contrast: number };

export function adjust(gray: Uint8Array, { brightness, contrast }: Adjustments): Uint8Array {
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const offset = brightness * 2.55;

  // Uint8ClampedArray saturates at 0 and 255, where Uint8Array would wrap around.
  const out = Uint8ClampedArray.from(gray, (value) => factor * (value - 128) + 128 + offset);
  return new Uint8Array(out.buffer);
}

export function toInk(gray: Uint8Array, width: number, height: number, mode: InkMode): Uint8Array {
  return mode === "dither" ? dither(gray, width, height) : threshold(gray);
}

/** Flip each row left to right. Transfers go on face down, so prints are mirrored. */
export function mirror(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out[y * width + x] = pixels[y * width + (width - 1 - x)]!;
  }
  return out;
}
