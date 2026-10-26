/**
 * Convert grayscale pixels into the printer's 1-bit raster command.
 */

/** Floyd–Steinberg dither 8-bit grayscale (0 = black) into ink bits (1 = black). */
export function dither(gray: Uint8Array, width: number, height: number): Uint8Array {
  const error = Float32Array.from(gray);
  const ink = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const black = error[i]! < 128;
      ink[i] = black ? 1 : 0;

      const residual = error[i]! - (black ? 0 : 255);
      if (x + 1 < width) error[i + 1]! += (residual * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) error[i + width - 1]! += (residual * 3) / 16;
        error[i + width]! += (residual * 5) / 16;
        if (x + 1 < width) error[i + width + 1]! += residual / 16;
      }
    }
  }

  return ink;
}

/** Threshold grayscale into ink bits without dithering, for line art. */
export function threshold(gray: Uint8Array, cutoff = 128): Uint8Array {
  return gray.map((value) => (value < cutoff ? 1 : 0));
}

/** Split an image into one `GS v 0` command per band of rows. */
export function rasterBands(ink: Uint8Array, width: number, height: number, rowsPerBand: number): Uint8Array[] {
  const bands: Uint8Array[] = [];
  for (let top = 0; top < height; top += rowsPerBand) {
    const rows = Math.min(rowsPerBand, height - top);
    bands.push(rasterCommand(ink.subarray(top * width, (top + rows) * width), width, rows));
  }
  return bands;
}

/**
 * Pack ink bits into an ESC/POS `GS v 0` raster command.
 *
 * Each row is width / 8 bytes, and the leftmost dot sits in the high bit.
 */
export function rasterCommand(ink: Uint8Array, width: number, height: number): Uint8Array {
  if (width % 8 !== 0) throw new Error(`width ${width} must be a multiple of 8`);
  const rowBytes = width / 8;

  const out = new Uint8Array(8 + rowBytes * height);
  out.set([0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, height & 0xff, height >> 8]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x]) out[8 + y * rowBytes + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }

  return out;
}
