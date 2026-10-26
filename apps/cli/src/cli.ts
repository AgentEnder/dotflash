/**
 * Drive the tattoo printer from the terminal.
 *
 * Usage:
 *   bun cli status
 *   bun cli scan [seconds]
 *   bun cli feed [lines]
 *   bun cli print <image> [--density light|medium|dark] [--threshold] [--no-mirror]
 *                         [--brightness n] [--contrast n] [--dry-run]
 *   bun cli pattern <ruler|ladder|corner|wedge> [--density ...] [--dry-run]
 *   bun cli export-patterns [dir]
 *
 * Close the phone app first. The printer stops advertising over BLE while it holds a connection.
 */

import { parseArgs } from "node:util";

import sharp from "sharp";

import {
  adjust,
  buildPrintJob,
  COMMANDS,
  DENSITY,
  type Density,
  feedCommand,
  HEAD_DOTS,
  mirror,
  PATTERNS,
  type PatternName,
  Printer,
  toInk,
} from "@dotflash/printer";

import { connectNoble, scan } from "./noble";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    density: { type: "string", default: "medium" },
    threshold: { type: "boolean", default: false },
    "no-mirror": { type: "boolean", default: false },
    brightness: { type: "string", default: "0" },
    contrast: { type: "string", default: "0" },
    "dry-run": { type: "boolean", default: false },
  },
});

const [command, argument] = positionals;

async function withPrinter(action: (printer: Printer) => Promise<void>): Promise<void> {
  const printer = new Printer(await connectNoble());
  try {
    await action(printer);
  } finally {
    await printer.close();
  }
}

async function printGray(gray: Uint8Array, height: number, mirrored: boolean): Promise<void> {
  const density = values.density as Density;
  if (!(density in DENSITY)) throw new Error(`--density must be one of ${Object.keys(DENSITY).join(", ")}`);

  const adjusted = adjust(gray, { brightness: Number(values.brightness), contrast: Number(values.contrast) });
  const oriented = mirrored ? mirror(adjusted, HEAD_DOTS, height) : adjusted;
  const ink = toInk(oriented, HEAD_DOTS, height, values.threshold ? "threshold" : "dither");
  const job = buildPrintJob(ink, HEAD_DOTS, height, density);
  console.log(`${HEAD_DOTS}x${height} dots, ${job.bands.length} bands, density ${density}`);
  if (values["dry-run"]) return;

  await withPrinter(async (printer) => {
    const started = Date.now();
    await printer.print(job, (sent, total) => {
      if (sent % 20 === 0 || sent === total) process.stdout.write(`\rband ${sent}/${total}`);
    });
    console.log(`\nprinted in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  });
}

async function loadGray(path: string): Promise<{ gray: Uint8Array; height: number }> {
  // Flatten transparency onto white paper before converting to grayscale.
  const { data, info } = await sharp(path)
    .flatten({ background: "#ffffff" })
    .resize({ width: HEAD_DOTS })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { gray: new Uint8Array(data.buffer, data.byteOffset, data.length), height: info.height };
}

switch (command) {
  case "status":
    await withPrinter(async (printer) => {
      console.log(await printer.status());
      for (const name of ["queryProduct", "querySerial", "queryPaper"] as const) {
        console.log(`${name}: ${JSON.stringify(await printer.query(COMMANDS[name]))}`);
      }
    });
    break;

  case "scan":
    for (const device of await scan(Number(argument ?? 10))) {
      console.log(`${String(device.rssi).padStart(4)} dBm  ${device.id}  ${device.name ?? "(no name)"}`);
    }
    break;

  case "feed":
    await withPrinter((printer) => printer.send(feedCommand(Number(argument ?? 4))));
    break;

  case "print": {
    if (!argument) throw new Error("usage: bun cli print <image>");
    const { gray, height } = await loadGray(argument);
    await printGray(gray, height, !values["no-mirror"]);
    break;
  }

  case "pattern": {
    const pattern = PATTERNS[argument as PatternName];
    if (!pattern) throw new Error(`pattern must be one of ${Object.keys(PATTERNS).join(", ")}`);
    const { gray, height } = pattern();
    await printGray(gray, height, false);
    break;
  }

  case "export-patterns": {
    const dir = argument ?? "test-images";
    for (const [name, pattern] of Object.entries(PATTERNS)) {
      const { gray, width, height } = pattern();
      await sharp(gray, { raw: { width, height, channels: 1 } }).png().toFile(`${dir}/test-${name}.png`);
      console.log(`${dir}/test-${name}.png`);
    }
    break;
  }

  default:
    throw new Error("usage: bun cli <status|scan|feed|print|pattern|export-patterns>");
}

process.exit(0);
