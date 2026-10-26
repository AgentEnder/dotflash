/**
 * Slice the rendered sheet into printer ink, and turn ink back into a preview image.
 */

import { adjust, type Adjustments, type InkMode, mirror, toInk } from "@dotflash/printer";

/** The printable area as 8-bit grayscale, one pixel per printer dot. */
export type Snapshot = { gray: Uint8Array; width: number; height: number };

export type SliceSettings = Adjustments & { mode: InkMode; mirror: boolean };

export type Slice = {
  /** Ink bits (1 = black) exactly as they will be sent, already mirrored. */
  ink: Uint8Array;
  width: number;
  /** Rows to send. Blank rows below the artwork are dropped because the eject feed clears them. */
  height: number;
  image: HTMLCanvasElement;
  coverage: number;
  mirrored: boolean;
};

/** Read a canvas as grayscale, flattening transparency onto white paper. */
export function snapshot(canvas: HTMLCanvasElement): Snapshot {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    const alpha = data[i * 4 + 3]! / 255;
    const luma = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    gray[i] = luma * alpha + 255 * (1 - alpha);
  }
  return { gray, width: canvas.width, height: canvas.height };
}

function lastInkedRow(ink: Uint8Array, width: number): number {
  for (let i = ink.length - 1; i >= 0; i--) if (ink[i]) return Math.floor(i / width);
  return -1;
}

/** Paint ink bits onto a canvas covering the whole printable area. */
function inkToCanvas(ink: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, height);
  image.data.fill(255);
  for (let i = 0; i < ink.length; i++) {
    if (ink[i]) image.data.set([20, 20, 20], i * 4);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function slice({ gray, width, height }: Snapshot, settings: SliceSettings): Slice {
  const ink = toInk(adjust(gray, settings), width, height, settings.mode);
  const printed = settings.mirror ? mirror(ink, width, height) : ink;
  const rows = lastInkedRow(printed, width) + 1;

  return {
    ink: printed.subarray(0, rows * width),
    width,
    height: rows,
    image: inkToCanvas(printed, width, height),
    coverage: printed.reduce((sum, bit) => sum + bit, 0) / printed.length,
    mirrored: settings.mirror,
  };
}
