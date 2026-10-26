import { type Density, HEAD_DOTS, SHEET, SHEET_ROWS } from "@dotflash/printer";
import type Konva from "konva";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { align } from "./align";
import { DesignPanel } from "./DesignPanel";
import { PreviewPanel } from "./PreviewPanel";
import { slice, type SliceSettings, type Snapshot, snapshot } from "./render";
import { type Item, SheetStage } from "./SheetStage";
import { useElementSize } from "./useElementSize";
import { useBackgroundRemoval } from "./useBackgroundRemoval";
import { usePrinter } from "./usePrinter";
import { openWelcome } from "./welcome";

const mm = (dots: number) => dots / 8;

type Action =
  | { type: "add"; item: Item }
  | { type: "update"; item: Item }
  | { type: "setImage"; id: string; image: HTMLImageElement; original?: HTMLImageElement }
  | { type: "remove"; id: string };

function itemsReducer(items: Item[], action: Action): Item[] {
  switch (action.type) {
    case "add":
      return [...items, action.item];
    case "update":
      return items.map((item) => (item.id === action.item.id ? action.item : item));
    case "remove":
      return items.filter((item) => item.id !== action.id);
    case "setImage":
      return items.map((item) =>
        item.id === action.id ? { ...item, image: action.image, original: action.original } : item,
      );
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image"));
    image.src = URL.createObjectURL(file);
  });
}

/** Centre an image on the sheet, scaled to fit within 90% of it. */
function fitted(image: HTMLImageElement, id: string): Item {
  const scale = Math.min((HEAD_DOTS * 0.9) / image.width, (SHEET_ROWS * 0.9) / image.height);
  return {
    id,
    image,
    x: HEAD_DOTS / 2,
    y: SHEET_ROWS / 2,
    width: image.width * scale,
    height: image.height * scale,
    rotation: 0,
  };
}

export function App() {
  const [items, dispatch] = useReducer(itemsReducer, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SliceSettings>({ mode: "dither", brightness: 0, contrast: 0, mirror: true });
  const [density, setDensity] = useState<Density>("medium");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [dragging, setDragging] = useState(false);

  const table = useRef<HTMLDivElement>(null);
  const content = useRef<Konva.Layer>(null);
  const size = useElementSize(table);
  const printer = usePrinter();
  const removal = useBackgroundRemoval();

  const scale = Math.max(0.1, Math.min((size.width - 48) / SHEET.width, (size.height - 72) / SHEET.height));
  const selected = items.find((item) => item.id === selectedId);

  // Dithering is the slow step, and print progress re-renders hundreds of times per print.
  const sliced = useMemo(() => snap && slice(snap, settings), [snap, settings]);

  /** Capture the printable area at one pixel per printer dot. Preview and print work from this capture. */
  function enterPreview() {
    const canvas = content.current!.toCanvas({
      x: SHEET.printLeft * scale,
      y: SHEET.printTop * scale,
      width: HEAD_DOTS * scale,
      height: SHEET_ROWS * scale,
      pixelRatio: 1 / scale,
    });
    setSnap(snapshot(canvas));
    setSelectedId(null);
  }

  async function addFiles(files: Iterable<Blob>) {
    if (snap) return;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const item = fitted(await loadImage(file), crypto.randomUUID());
      dispatch({ type: "add", item });
      setSelectedId(item.id);
    }
  }

  async function removeBackground() {
    if (!selected) return;
    const blob = await removal.remove(selected.image);
    if (!blob) return;
    const image = await loadImage(blob);
    dispatch({ type: "setImage", id: selected.id, image, original: selected.original ?? selected.image });
  }

  function restoreOriginal() {
    if (!selected?.original) return;
    dispatch({ type: "setImage", id: selected.id, image: selected.original });
  }

  function removeSelected() {
    if (!selectedId) return;
    dispatch({ type: "remove", id: selectedId });
    setSelectedId(null);
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = [...(event.clipboardData?.items ?? [])].flatMap((entry) => entry.getAsFile() ?? []);
      if (files.length) void addFiles(files);
    }
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Delete" || event.key === "Backspace") removeSelected();
    }
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  });

  const printing = printer.state.phase === "printing";

  return (
    <div className="app">
      <div
        ref={table}
        className={dragging ? "table dragging" : "table"}
        onDragOver={(event) => {
          event.preventDefault();
          if (!snap) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        {/* Switching stages mid-print would drop the job in progress, so the tabs hide while printing. */}
        {!printing && (
          <nav className="stages">
            <button aria-current={!snap ? "step" : undefined} onClick={() => setSnap(null)}>
              1 Design
            </button>
            {items.length > 0 && (
              <button aria-current={snap ? "step" : undefined} onClick={enterPreview}>
                2 Preview
              </button>
            )}
          </nav>
        )}

        <SheetStage
          scale={scale}
          items={items}
          selectedId={selectedId}
          preview={sliced?.image ?? null}
          contentRef={content}
          onSelect={setSelectedId}
          onChange={(item) => dispatch({ type: "update", item })}
        />

        <button className="about" onClick={openWelcome}>
          About
        </button>

        <span className="sheet-size">
          sheet {mm(SHEET.width)} × {mm(SHEET.height)} mm · printable {mm(HEAD_DOTS)} × {mm(SHEET_ROWS)} mm
        </span>
      </div>

      <aside className="panel">
        {sliced ? (
          <PreviewPanel
            slice={sliced}
            settings={settings}
            density={density}
            printer={printer.state}
            onSettings={setSettings}
            onDensity={setDensity}
            onConnect={() => void printer.connect()}
            onPrint={() => void printer.print({ ink: sliced.ink, width: sliced.width, height: sliced.height, density })}
            onBack={() => setSnap(null)}
          />
        ) : (
          <DesignPanel
            hasSelection={!!selected}
            hasArtwork={items.length > 0}
            onAddFiles={(files) => void addFiles(files)}
            onAlign={(horizontal, vertical) =>
              selected &&
              dispatch({
                type: "update",
                item: align(selected, horizontal, vertical, { width: HEAD_DOTS, height: SHEET_ROWS }),
              })
            }
            removal={removal.state}
            canRestore={!!selected?.original}
            onRemoveBackground={() => void removeBackground()}
            onRestore={restoreOriginal}
            onFit={() =>
              selected && dispatch({ type: "update", item: { ...fitted(selected.image, selected.id), original: selected.original } })
            }
            onDelete={removeSelected}
            onPreview={enterPreview}
          />
        )}
      </aside>
    </div>
  );
}
