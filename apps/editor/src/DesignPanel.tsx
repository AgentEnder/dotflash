import { type CSSProperties, useRef } from "react";

import type { Anchor } from "./align";
import type { RemovalState } from "./useBackgroundRemoval";
import { Waffle } from "./Waffle";

type Props = {
  hasSelection: boolean;
  hasArtwork: boolean;
  removal: RemovalState;
  canRestore: boolean;
  onAddFiles: (files: Iterable<Blob>) => void;
  onAlign: (horizontal: Anchor, vertical: Anchor) => void;
  onFit: () => void;
  onDelete: () => void;
  onRemoveBackground: () => void;
  onRestore: () => void;
  onPreview: () => void;
};

export function DesignPanel({
  hasSelection,
  hasArtwork,
  removal,
  canRestore,
  onAddFiles,
  onAlign,
  onFit,
  onDelete,
  onRemoveBackground,
  onRestore,
  onPreview,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <section className="section">
        <h2>Artwork</h2>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            onAddFiles(event.target.files ?? []);
            event.target.value = "";
          }}
        />
        <button onClick={() => fileInput.current?.click()}>Add image…</button>
        <p className="hint">Or drop or paste an image onto the sheet.</p>
        {hasSelection ? (
          <div className="arrange">
            <Waffle onAlign={onAlign} />
            <div className="arrange-actions">
              <button onClick={onFit}>Fit</button>
              <button onClick={onDelete}>Delete</button>
            </div>
          </div>
        ) : (
          hasArtwork && <p className="hint">Select an image to arrange it.</p>
        )}
      </section>

      {/* A running removal stays visible even if the selection changes underneath it. */}
      {(hasSelection || removal.phase === "running") && (
        <section className="section">
          <h2>Background</h2>
          {removal.phase === "running" ? (
            <div
              className={removal.progress === undefined ? "inline-progress indeterminate" : "inline-progress"}
              role="progressbar"
              aria-valuenow={removal.progress === undefined ? undefined : Math.round(removal.progress * 100)}
              style={{ "--progress": removal.progress ?? 0 } as CSSProperties}
            >
              {removal.label}
            </div>
          ) : canRestore ? (
            <button onClick={onRestore}>Restore original</button>
          ) : (
            <button onClick={onRemoveBackground}>Remove background</button>
          )}
          {removal.phase === "idle" && removal.error && <p className="error">{removal.error}</p>}
        </section>
      )}

      {hasArtwork && (
        <section className="section">
          <button className="primary" onClick={onPreview}>
            Preview →
          </button>
        </section>
      )}
    </>
  );
}
