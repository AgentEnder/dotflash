/**
 * Wire protocol for the Hello Blink tattoo printer (advertises as WS-171C).
 *
 * The printer's Microchip module bridges BLE "Transparent UART" to the same serial stream the
 * official app writes over classic SPP, so commands are plain ESC/POS-style bytes.
 * Nothing here touches Bluetooth, so it runs in Bun and in the browser.
 */

import { rasterBands } from "./raster";

export const SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
export const NOTIFY_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
export const WRITE_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
export const DEVICE_NAME = "WS-171C";

/** Dots across the print head. */
export const HEAD_DOTS = 384;

/** Printable rows on one sheet at 8 dots per mm. Printing starts 7.5 mm into the 69 mm sheet and stops about 57.5 mm later. */
export const SHEET_ROWS = 456;

/**
 * The physical 50 × 69 mm sheet in dots, and where the printable area sits on it.
 * The head is assumed centred across the 50 mm width.
 */
export const SHEET = {
  width: 400,
  height: 552,
  printLeft: (400 - HEAD_DOTS) / 2,
  printTop: 60,
} as const;

/** Bytes per BLE write. Fits the ATT MTU that macOS and Android negotiate. */
export const CHUNK_BYTES = 180;

/**
 * Rows per raster command. The printer advances the paper about one row per command, however
 * many rows the command holds, so multi-row commands print squashed. Tall commands also outrun
 * BLE and lose their tail. One row per command prints at true scale.
 */
export const ROWS_PER_BAND = 1;

/** A line feed moves about 3 mm and a sheet is 69 mm long, so this always clears the sheet. */
export const EJECT_LINES = 20;

/** Darkness levels the app uses for "public" printers (product id 200 and up), such as this one. */
export const DENSITY = { light: 20, medium: 25, dark: 30 } as const;
export type Density = keyof typeof DENSITY;

export const COMMANDS = {
  reset: Uint8Array.of(0x1b, 0x40),
  queryStatus: Uint8Array.of(0x1e, 0x47, 0x03),
  queryProduct: Uint8Array.of(0x1d, 0x67, 0x69),
  queryPaper: Uint8Array.of(0x1d, 0x67, 0x53),
  querySerial: Uint8Array.of(0x1d, 0x67, 0x39),
};

export function densityCommand(density: Density): Uint8Array {
  return Uint8Array.of(0x1d, 0x49, 0xf0, DENSITY[density]);
}

/** Line feeds are the only command that moves paper. Blank raster rows and `ESC J` are ignored. */
export function feedCommand(lines: number): Uint8Array {
  return new Uint8Array(lines).fill(0x0a);
}

export type PrinterStatus = { firmware?: string; millivolts?: number; dpi?: number; raw: string };

/** Parse a status reply such as `HV=H1.0,SV=V1.01,VOLT=7680mv,DPI=384,`. */
export function parseStatus(raw: string): PrinterStatus {
  const field = (key: string) => raw.match(new RegExp(`${key}=([^,\\s\\0]+)`))?.[1];
  const volts = field("VOLT")?.match(/^(\d+)/)?.[1];
  const dpi = field("DPI");
  return {
    firmware: field("SV"),
    millivolts: volts ? Number(volts) : undefined,
    dpi: dpi ? Number(dpi) : undefined,
    raw,
  };
}

export type PrintJob = { setup: Uint8Array[]; bands: Uint8Array[]; eject: Uint8Array };

/** Build the command sequence for one sheet from ink bits (1 = black). */
export function buildPrintJob(ink: Uint8Array, width: number, height: number, density: Density): PrintJob {
  return {
    setup: [densityCommand(density), COMMANDS.reset],
    bands: rasterBands(ink, width, height, ROWS_PER_BAND),
    eject: feedCommand(EJECT_LINES),
  };
}
