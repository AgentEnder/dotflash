import { HEAD_DOTS, SHEET, SHEET_ROWS } from "@dotflash/printer";
import type Konva from "konva";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";

import { type Box, type Snap, snapResize, snapToEdges } from "./align";

export type Item = {
  id: string;
  image: HTMLImageElement;
  /** The image as imported, kept after background removal so it can be restored. */
  original?: HTMLImageElement;
  /** Centre of the image in printable-area dots. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type Props = {
  scale: number;
  items: Item[];
  selectedId: string | null;
  preview: HTMLCanvasElement | null;
  contentRef: RefObject<Konva.Layer | null>;
  onSelect: (id: string | null) => void;
  onChange: (item: Item) => void;
};

const PRINTABLE = { x: SHEET.printLeft, y: SHEET.printTop, width: HEAD_DOTS, height: SHEET_ROWS };

/** Snap distance in screen pixels, so it feels the same at any zoom. */
const SNAP_PIXELS = 8;

const NO_GUIDES: Snap["guides"] = { vertical: [], horizontal: [] };

export function SheetStage({ scale, items, selectedId, preview, contentRef, onSelect, onChange }: Props) {
  const transformer = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Image>());
  const [guides, setGuides] = useState(NO_GUIDES);
  const altHeld = useRef(false);

  // Konva's resize hook gets no pointer event, so track Alt for free placement here.
  useEffect(() => {
    const track = (event: KeyboardEvent) => (altHeld.current = event.altKey);
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    return () => {
      window.removeEventListener("keydown", track);
      window.removeEventListener("keyup", track);
    };
  }, []);

  useEffect(() => {
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    transformer.current?.nodes(node && !preview ? [node] : []);
  }, [selectedId, items, preview]);

  function commitTransform(item: Item, node: Konva.Image) {
    const width = Math.max(4, item.width * node.scaleX());
    const height = Math.max(4, item.height * node.scaleY());
    node.scale({ x: 1, y: 1 });
    onChange({ ...item, x: node.x(), y: node.y(), width, height, rotation: node.rotation() });
  }

  /** Pull the dragged item flush to nearby printable edges. Holding Alt places it freely. */
  function snapWhileDragging(item: Item, event: Konva.KonvaEventObject<DragEvent>) {
    if (event.evt.altKey) return setGuides(NO_GUIDES);
    const node = event.target;
    const snap = snapToEdges({ ...item, x: node.x(), y: node.y() }, PRINTABLE, SNAP_PIXELS / scale);
    node.position({ x: snap.x, y: snap.y });
    setGuides(snap.guides);
  }

  /** Snap the edges a resize handle moves onto nearby printable edges. Unrotated artwork only. */
  function snapWhileResizing(_: Box & { rotation: number }, next: Box & { rotation: number }) {
    const anchor = transformer.current?.getActiveAnchor();
    const unrotated = Math.abs(Math.sin(next.rotation)) < 1e-6 && Math.cos(next.rotation) > 0;
    if (!anchor || !unrotated || altHeld.current) {
      setGuides(NO_GUIDES);
      return next;
    }

    // Konva sizes the box in stage pixels, so compare against the printable area in pixels too.
    const area = {
      x: PRINTABLE.x * scale,
      y: PRINTABLE.y * scale,
      width: PRINTABLE.width * scale,
      height: PRINTABLE.height * scale,
    };
    const { box, guides } = snapResize(next, anchor, area, SNAP_PIXELS);
    setGuides({
      vertical: guides.vertical.map((x) => (x - area.x) / scale),
      horizontal: guides.horizontal.map((y) => (y - area.y) / scale),
    });
    return { ...box, rotation: next.rotation };
  }

  function deselectOutsideArtwork(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const onArtwork = event.target.name() === "artwork";
    const onHandles = event.target.findAncestor("Transformer") !== undefined;
    if (!onArtwork && !onHandles) onSelect(null);
  }

  return (
    <Stage
      width={SHEET.width * scale}
      height={SHEET.height * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={deselectOutsideArtwork}
      onTouchStart={deselectOutsideArtwork}
    >
      <Layer listening={false}>
        <Rect width={SHEET.width} height={SHEET.height} fill="#a9a6a0" cornerRadius={4} />
        <Rect {...PRINTABLE} fill="#ffffff" />
      </Layer>

      <Layer
        ref={contentRef}
        x={PRINTABLE.x}
        y={PRINTABLE.y}
        clipX={0}
        clipY={0}
        clipWidth={PRINTABLE.width}
        clipHeight={PRINTABLE.height}
      >
        {items.map((item) => (
          <KonvaImage
            key={item.id}
            ref={(node) => {
              if (node) nodes.current.set(item.id, node);
              else nodes.current.delete(item.id);
            }}
            name="artwork"
            image={item.image}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            offsetX={item.width / 2}
            offsetY={item.height / 2}
            rotation={item.rotation}
            draggable={!preview}
            onMouseDown={() => onSelect(item.id)}
            onTap={() => onSelect(item.id)}
            onDragMove={(event) => snapWhileDragging(item, event)}
            onDragEnd={(event) => {
              setGuides(NO_GUIDES);
              onChange({ ...item, x: event.target.x(), y: event.target.y() });
            }}
            onTransformEnd={(event) => {
              setGuides(NO_GUIDES);
              commitTransform(item, event.target as Konva.Image);
            }}
          />
        ))}
      </Layer>

      {preview && (
        <Layer x={PRINTABLE.x} y={PRINTABLE.y} imageSmoothingEnabled={false} listening={false}>
          <KonvaImage image={preview} width={PRINTABLE.width} height={PRINTABLE.height} />
        </Layer>
      )}

      <Layer listening={false}>
        <Rect {...PRINTABLE} stroke="#6f6c66" strokeWidth={1 / scale} dash={[4 / scale, 3 / scale]} />
      </Layer>

      <Layer x={PRINTABLE.x} y={PRINTABLE.y} listening={false}>
        {guides.vertical.map((x) => (
          <Line key={`v${x}`} points={[x, 0, x, PRINTABLE.height]} stroke="#ff5a1f" strokeWidth={1.5 / scale} />
        ))}
        {guides.horizontal.map((y) => (
          <Line key={`h${y}`} points={[0, y, PRINTABLE.width, y]} stroke="#ff5a1f" strokeWidth={1.5 / scale} />
        ))}
      </Layer>

      <Layer>
        <Transformer
          ref={transformer}
          rotationSnaps={[0, 90, 180, 270]}
          boundBoxFunc={snapWhileResizing}
          borderStroke="#ff5a1f"
          anchorStroke="#ff5a1f"
          anchorFill="#1d1e20"
          anchorSize={9}
          ignoreStroke
        />
      </Layer>
    </Stage>
  );
}
