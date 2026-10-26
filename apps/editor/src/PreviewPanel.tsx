import { DENSITY, type Density } from "@dotflash/printer";
import { webBluetoothAvailable } from "@dotflash/printer/web-bluetooth";

import type { Slice, SliceSettings } from "./render";
import type { PrinterState } from "./usePrinter";

type Props = {
  slice: Slice;
  settings: SliceSettings;
  density: Density;
  printer: PrinterState;
  onSettings: (settings: SliceSettings) => void;
  onDensity: (density: Density) => void;
  onConnect: () => void;
  onPrint: () => void;
  onBack: () => void;
};

export function PreviewPanel({ slice, settings, density, printer, onSettings, onDensity, onConnect, onPrint, onBack }: Props) {
  const printing = printer.phase === "printing";

  return (
    <>
      {!printing && (
        <section className="section">
          <button onClick={onBack}>← Back to design</button>
        </section>
      )}

      {/* Inputs lock rather than hide while printing, so the panel doesn't jump mid-print. */}
      <section className="section">
        <h2>Ink</h2>
        <label>
          Shading
          <select
            value={settings.mode}
            disabled={printing}
            onChange={(event) => onSettings({ ...settings, mode: event.target.value as SliceSettings["mode"] })}
          >
            <option value="dither">Dither (photos, gradients)</option>
            <option value="threshold">Threshold (line art)</option>
          </select>
        </label>
        {(["brightness", "contrast"] as const).map((key) => (
          <label key={key}>
            <span>
              {key === "brightness" ? "Brightness" : "Contrast"} <span className="value">{settings[key]}</span>
            </span>
            <input
              type="range"
              min={-100}
              max={100}
              value={settings[key]}
              disabled={printing}
              onChange={(event) => onSettings({ ...settings, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={settings.mirror}
            disabled={printing}
            onChange={(event) => onSettings({ ...settings, mirror: event.target.checked })}
          />
          Mirror for face-down transfer
        </label>
      </section>

      <section className="section">
        <h2>Slice</h2>
        <dl className="stats">
          <dt>Rows</dt>
          <dd>
            {slice.height} ({(slice.height / 8).toFixed(1)} mm)
          </dd>
          <dt>Ink</dt>
          <dd>{(slice.coverage * 100).toFixed(1)}% of dots</dd>
          <dt>Orientation</dt>
          <dd>{slice.mirrored ? "Mirrored, as on paper" : "Not mirrored"}</dd>
        </dl>
      </section>

      <section className="section">
        <h2>Printer</h2>
        {!webBluetoothAvailable() && <p className="error">This browser has no Web Bluetooth. Use Chrome or Edge.</p>}
        {printer.phase === "disconnected" && webBluetoothAvailable() && (
          <>
            <button onClick={onConnect}>Connect printer…</button>
            {printer.error && <p className="error">{printer.error}</p>}
            <p className="hint">Close the Tattoo Maker app first, or the printer stays hidden.</p>
          </>
        )}
        {printer.phase === "connecting" && <p className="status">Connecting…</p>}
        {(printer.phase === "ready" || printing) && (
          <p className="status">
            {printer.status.firmware} · {((printer.status.millivolts ?? 0) / 1000).toFixed(2)} V
          </p>
        )}
        <label>
          Darkness
          <select value={density} disabled={printing} onChange={(event) => onDensity(event.target.value as Density)}>
            {Object.keys(DENSITY).map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">Press the lid down while printing, or the right edge prints faint.</p>
        {printing && <progress value={printer.progress} />}
        {printer.phase === "ready" &&
          (slice.height > 0 ? (
            <button className="primary" onClick={onPrint}>
              Print
            </button>
          ) : (
            <p className="hint">Nothing to print. The sheet has no ink.</p>
          ))}
      </section>
    </>
  );
}
