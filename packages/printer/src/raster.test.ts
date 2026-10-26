import { expect, test } from "bun:test";

import { dither, rasterBands, rasterCommand, threshold } from "./raster";

test("rasterBands splits rows into separate commands with a short final band", () => {
  const ink = new Uint8Array(8 * 10);
  ink[8 * 9] = 1;
  const bands = rasterBands(ink, 8, 10, 4);
  expect(bands.map((band) => band[6])).toEqual([4, 4, 2]);
  expect([...bands[2]!.subarray(8)]).toEqual([0, 0b1000_0000]);
});

test("rasterCommand writes the GS v 0 header with little-endian sizes", () => {
  const command = rasterCommand(new Uint8Array(16 * 300), 16, 300);
  expect([...command.subarray(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 300 & 0xff, 300 >> 8]);
  expect(command.length).toBe(8 + 2 * 300);
});

test("rasterCommand puts the leftmost dot in the high bit", () => {
  const ink = new Uint8Array(16);
  ink[0] = 1;
  ink[9] = 1;
  ink[15] = 1;
  expect([...rasterCommand(ink, 16, 1).subarray(8)]).toEqual([0b1000_0000, 0b0100_0001]);
});

test("rasterCommand rejects widths that are not whole bytes", () => {
  expect(() => rasterCommand(new Uint8Array(10), 10, 1)).toThrow();
});

test("threshold maps dark pixels to ink", () => {
  expect([...threshold(Uint8Array.from([0, 127, 128, 255]))]).toEqual([1, 1, 0, 0]);
});

test("dither keeps solid black and white exact", () => {
  expect([...dither(new Uint8Array(64).fill(0), 8, 8)].every((bit) => bit === 1)).toBe(true);
  expect([...dither(new Uint8Array(64).fill(255), 8, 8)].every((bit) => bit === 0)).toBe(true);
});

test("dither inks roughly half the dots for mid gray", () => {
  const ink = dither(new Uint8Array(64 * 64).fill(128), 64, 64);
  const coverage = ink.reduce((sum, bit) => sum + bit, 0) / ink.length;
  expect(coverage).toBeGreaterThan(0.45);
  expect(coverage).toBeLessThan(0.55);
});
