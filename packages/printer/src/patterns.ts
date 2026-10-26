/**
 * Test patterns as 8-bit grayscale (0 = black), sized to the print head.
 */

import { HEAD_DOTS, SHEET_ROWS } from "./protocol";

export const DOTS_PER_MM = 8;

export type Pattern = { width: number; height: number; gray: Uint8Array };

function draw(height: number, pixel: (x: number, y: number) => boolean): Pattern {
  const gray = new Uint8Array(HEAD_DOTS * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < HEAD_DOTS; x++) gray[y * HEAD_DOTS + x] = pixel(x, y) ? 0 : 255;
  }
  return { width: HEAD_DOTS, height, gray };
}

/**
 * A ruler covering the printable area, to check vertical scale and alignment.
 *
 * Ticks mark every millimetre down the left edge. Full-width lines mark every 5 mm, and every
 * 10 mm line is twice as thick. Thin lines run down both edges and the centre.
 */
export function ruler(): Pattern {
  const mm = DOTS_PER_MM;
  return draw(SHEET_ROWS, (x, y) => {
    const edge = x < 2 || x >= HEAD_DOTS - 2 || Math.abs(x - HEAD_DOTS / 2) < 1;
    const tick = y % mm === 0 && x < 3 * mm;
    const fiveMm = y % (5 * mm) < 2;
    const tenMm = y % (10 * mm) < 4;
    return edge || tick || fiveMm || tenMm;
  });
}

/** A left-edge stripe plus a rung every 64 rows. Dropped data shows as gaps or shifted rungs. */
export function ladder(): Pattern {
  return draw(HEAD_DOTS, (x, y) => x < 16 || y % 64 < 8);
}

/** A black square top-left plus a bar across the middle. The asymmetry reveals orientation. */
export function corner(): Pattern {
  return draw(HEAD_DOTS, (x, y) => (x < 96 && y < 96) || (y >= 176 && y < 208));
}

/** Eight vertical bands stepping from white to black, to check dithering. */
export function wedge(): Pattern {
  const gray = new Uint8Array(HEAD_DOTS * HEAD_DOTS);
  for (let i = 0; i < gray.length; i++) gray[i] = 255 - Math.floor((i % HEAD_DOTS) / (HEAD_DOTS / 8)) * 36;
  return { width: HEAD_DOTS, height: HEAD_DOTS, gray };
}

export const PATTERNS = { ruler, ladder, corner, wedge };
export type PatternName = keyof typeof PATTERNS;
