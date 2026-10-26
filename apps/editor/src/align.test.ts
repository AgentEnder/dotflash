import { expect, test } from "bun:test";

import { align, footprint, snapResize, snapToEdges } from "./align";
import type { Item } from "./SheetStage";

const area = { width: 384, height: 456 };
const item = { id: "a", image: {} as HTMLImageElement, x: 0, y: 0, width: 100, height: 40, rotation: 0 } satisfies Item;

test("align top left puts the item's corner on the area's corner", () => {
  const { x, y } = align(item, "start", "start", area);
  expect([x - 50, y - 20]).toEqual([0, 0]);
});

test("align centre puts the item's centre on the area's centre", () => {
  const { x, y } = align(item, "center", "center", area);
  expect([x, y]).toEqual([192, 228]);
});

test("align bottom right puts the item's far corner on the area's far corner", () => {
  const { x, y } = align(item, "end", "end", area);
  expect([x + 50, y + 20]).toEqual([384, 456]);
});

test("footprint swaps width and height at a quarter turn", () => {
  const box = footprint({ width: 100, height: 40, rotation: 90 });
  expect(box.width).toBeCloseTo(40);
  expect(box.height).toBeCloseTo(100);
});

test("align uses the rotated footprint, so a rotated item still touches the edge", () => {
  const { x } = align({ ...item, rotation: 90 }, "start", "center", area);
  expect(x).toBeCloseTo(20);
});

test("snapToEdges pulls a near edge flush and reports the guide", () => {
  const snap = snapToEdges({ ...item, x: 53, y: 228 }, area, 5);
  expect(snap.x).toBe(50);
  expect(snap.guides.vertical).toEqual([0]);
  expect(snap.guides.horizontal).toEqual([]);
});

test("snapToEdges snaps the far edges on both axes", () => {
  const snap = snapToEdges({ ...item, x: 384 - 50 - 4, y: 456 - 20 + 3 }, area, 5);
  expect([snap.x, snap.y]).toEqual([334, 436]);
  expect(snap.guides).toEqual({ vertical: [384], horizontal: [456] });
});

test("snapToEdges leaves an item alone outside the threshold", () => {
  const snap = snapToEdges({ ...item, x: 100, y: 200 }, area, 5);
  expect([snap.x, snap.y]).toEqual([100, 200]);
  expect(snap.guides).toEqual({ vertical: [], horizontal: [] });
});

const sheet = { x: 0, y: 0, width: 384, height: 456 };

test("snapResize pulls a dragged side edge flush and keeps the opposite edge", () => {
  const { box, guides } = snapResize({ x: 100, y: 100, width: 280, height: 50 }, "middle-right", sheet, 5);
  expect(box).toEqual({ x: 100, y: 100, width: 284, height: 50 });
  expect(guides).toEqual({ vertical: [384], horizontal: [] });
});

test("snapResize on the left edge moves x and keeps the right edge fixed", () => {
  const { box } = snapResize({ x: 3, y: 100, width: 97, height: 50 }, "middle-left", sheet, 5);
  expect(box).toEqual({ x: 0, y: 100, width: 100, height: 50 });
});

test("snapResize corner keeps the aspect ratio and the opposite corner", () => {
  const { box, guides } = snapResize({ x: 104, y: 100, width: 200, height: 100 }, "top-left", { ...sheet, x: 100 }, 5);
  expect(box.x).toBe(100);
  expect(box.width).toBe(204);
  expect(box.height).toBe(102);
  expect(box.y + box.height).toBe(200);
  expect(guides.vertical).toEqual([100]);
});

test("snapResize corner snaps whichever edge is nearer", () => {
  const { box, guides } = snapResize({ x: 100, y: 100, width: 280, height: 355 }, "bottom-right", sheet, 5);
  expect(box.y + box.height).toBe(456);
  expect(guides).toEqual({ vertical: [], horizontal: [456] });
});

test("snapResize ignores edges the handle doesn't move", () => {
  const { box } = snapResize({ x: 2, y: 100, width: 100, height: 50 }, "middle-right", sheet, 5);
  expect(box).toEqual({ x: 2, y: 100, width: 100, height: 50 });
});
