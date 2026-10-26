import { expect, test } from "bun:test";

import { buildPrintJob, EJECT_LINES, parseStatus, ROWS_PER_BAND } from "./protocol";

test("parseStatus reads firmware, battery and head width", () => {
  expect(parseStatus("HV=H1.0,SV=V1.01,VOLT=7680mv,DPI=384,\0")).toEqual({
    firmware: "V1.01",
    millivolts: 7680,
    dpi: 384,
    raw: "HV=H1.0,SV=V1.01,VOLT=7680mv,DPI=384,\0",
  });
});

test("parseStatus leaves missing fields undefined", () => {
  expect(parseStatus("err:\0.")).toEqual({ firmware: undefined, millivolts: undefined, dpi: undefined, raw: "err:\0." });
});

test("buildPrintJob sets density, resets, bands the image and ejects", () => {
  const job = buildPrintJob(new Uint8Array(16 * 10), 16, 10, "dark");

  expect(job.setup.map((command) => [...command])).toEqual([
    [0x1d, 0x49, 0xf0, 30],
    [0x1b, 0x40],
  ]);
  expect(job.bands).toHaveLength(Math.ceil(10 / ROWS_PER_BAND));
  expect([...job.eject]).toEqual(new Array(EJECT_LINES).fill(0x0a));
});
