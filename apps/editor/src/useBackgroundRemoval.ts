import { useState } from "react";

export type RemovalState = { phase: "idle"; error?: string } | { phase: "running"; label: string; progress?: number };

/**
 * Remove an image's background with imgly's in-browser model.
 *
 * The library and its ONNX runtime load on first use, and the model downloads from imgly's CDN.
 */
export function useBackgroundRemoval() {
  const [state, setState] = useState<RemovalState>({ phase: "idle" });

  async function remove(image: HTMLImageElement): Promise<Blob | null> {
    setState({ phase: "running", label: "Loading model…" });
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(image.src, {
        progress: (key, current, total) => {
          const downloading = key.startsWith("fetch");
          setState({
            phase: "running",
            label: downloading ? "Downloading model…" : "Removing background…",
            progress: downloading && total > 0 ? current / total : undefined,
          });
        },
      });
      setState({ phase: "idle" });
      return blob;
    } catch (error) {
      setState({ phase: "idle", error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  return { state, remove };
}
