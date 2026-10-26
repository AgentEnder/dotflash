import { expect, test } from "bun:test";

import { adjust, mirror } from "./image";

test("adjust leaves pixels unchanged at zero", () => {
  const gray = Uint8Array.from([0, 64, 128, 200, 255]);
  expect([...adjust(gray, { brightness: 0, contrast: 0 })]).toEqual([...gray]);
});

test("adjust brightens and clamps to the byte range", () => {
  expect([...adjust(Uint8Array.from([0, 128, 250]), { brightness: 50, contrast: 0 })]).toEqual([127, 255, 255]);
});

test("adjust contrast pushes values away from mid gray", () => {
  const [dark, mid, light] = adjust(Uint8Array.from([100, 128, 156]), { brightness: 0, contrast: 50 });
  expect(dark).toBeLessThan(100);
  expect(mid).toBe(128);
  expect(light).toBeGreaterThan(156);
});

test("mirror flips each row", () => {
  expect([...mirror(Uint8Array.from([1, 2, 3, 4, 5, 6]), 3, 2)]).toEqual([3, 2, 1, 6, 5, 4]);
});
