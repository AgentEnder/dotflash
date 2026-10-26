/**
 * Snap artwork to one of nine anchor points on the printable area.
 */

import type { Item } from "./SheetStage";

export type Anchor = "start" | "center" | "end";

/** Size of the axis-aligned box a rotated item covers. */
export function footprint({ width, height, rotation }: Pick<Item, "width" | "height" | "rotation">) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

function place(anchor: Anchor, size: number, area: number): number {
  if (anchor === "start") return size / 2;
  if (anchor === "end") return area - size / 2;
  return area / 2;
}

/** Move an item so its footprint touches the chosen edges of an area. Item x and y are its centre. */
export function align(item: Item, horizontal: Anchor, vertical: Anchor, area: { width: number; height: number }): Item {
  const box = footprint(item);
  return { ...item, x: place(horizontal, box.width, area.width), y: place(vertical, box.height, area.height) };
}

export type Snap = { x: number; y: number; guides: { vertical: number[]; horizontal: number[] } };

/** Snap one axis: pull an edge onto 0 or the far side when it is within `threshold`. */
function snapAxis(centre: number, size: number, area: number, threshold: number): { centre: number; guide?: number } {
  const start = centre - size / 2;
  const end = centre + size / 2;
  if (Math.abs(start) <= threshold) return { centre: size / 2, guide: 0 };
  if (Math.abs(end - area) <= threshold) return { centre: area - size / 2, guide: area };
  return { centre };
}

/** Snap an item's footprint to the edges of an area. `x` and `y` are its centre. */
export function snapToEdges(
  item: Pick<Item, "x" | "y" | "width" | "height" | "rotation">,
  area: { width: number; height: number },
  threshold: number,
): Snap {
  const box = footprint(item);
  const horizontal = snapAxis(item.x, box.width, area.width, threshold);
  const vertical = snapAxis(item.y, box.height, area.height, threshold);
  return {
    x: horizontal.centre,
    y: vertical.centre,
    guides: {
      vertical: horizontal.guide === undefined ? [] : [horizontal.guide],
      horizontal: vertical.guide === undefined ? [] : [vertical.guide],
    },
  };
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Snap a resize so the edges being dragged land flush on a nearby area edge.
 *
 * `anchor` is the Konva handle name, such as `top-left` or `middle-right`. Edges opposite the
 * handle stay fixed. Corner handles keep the box's aspect ratio, so only the nearer edge snaps
 * and the other dimension follows. Boxes and guides share one coordinate space.
 */
export function snapResize(box: Box, anchor: string, area: Box, threshold: number): { box: Box; guides: Snap["guides"] } {
  const moves = {
    left: anchor.includes("left"),
    right: anchor.includes("right"),
    top: anchor.includes("top"),
    bottom: anchor.includes("bottom"),
  };
  const right = box.x + box.width;
  const bottom = box.y + box.height;

  const nearest = (candidates: { moving: boolean; edge: number; target: number }[]) =>
    candidates
      .filter(({ moving, edge, target }) => moving && Math.abs(edge - target) <= threshold)
      .sort((a, b) => Math.abs(a.edge - a.target) - Math.abs(b.edge - b.target))[0];

  const horizontal = nearest([
    { moving: moves.left, edge: box.x, target: area.x },
    { moving: moves.right, edge: right, target: area.x + area.width },
  ]);
  const vertical = nearest([
    { moving: moves.top, edge: box.y, target: area.y },
    { moving: moves.bottom, edge: bottom, target: area.y + area.height },
  ]);

  let { x, y, width, height } = box;
  const snapX = (target: number) => {
    if (moves.left) [x, width] = [target, right - target];
    else width = target - box.x;
  };
  const snapY = (target: number) => {
    if (moves.top) [y, height] = [target, bottom - target];
    else height = target - box.y;
  };

  const corner = (moves.left || moves.right) && (moves.top || moves.bottom);
  if (corner) {
    const ratio = box.width / box.height;
    const useHorizontal =
      horizontal &&
      (!vertical || Math.abs(horizontal.edge - horizontal.target) <= Math.abs(vertical.edge - vertical.target));

    if (useHorizontal) {
      snapX(horizontal.target);
      height = width / ratio;
      if (moves.top) y = bottom - height;
    } else if (vertical) {
      snapY(vertical.target);
      width = height * ratio;
      if (moves.left) x = right - width;
    }
    return {
      box: { x, y, width, height },
      guides: {
        vertical: useHorizontal ? [horizontal.target] : [],
        horizontal: !useHorizontal && vertical ? [vertical.target] : [],
      },
    };
  }

  if (horizontal) snapX(horizontal.target);
  if (vertical) snapY(vertical.target);
  return {
    box: { x, y, width, height },
    guides: { vertical: horizontal ? [horizontal.target] : [], horizontal: vertical ? [vertical.target] : [] },
  };
}
