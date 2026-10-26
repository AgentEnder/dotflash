import { buildPrintJob, type Density, Printer, type PrinterStatus } from "@dotflash/printer";
import { connectWebBluetooth } from "@dotflash/printer/web-bluetooth";
import { useRef, useState } from "react";

export type PrinterState =
  | { phase: "disconnected"; error?: string }
  | { phase: "connecting" }
  | { phase: "ready"; status: PrinterStatus }
  | { phase: "printing"; status: PrinterStatus; progress: number };

export type PrintRequest = { ink: Uint8Array; width: number; height: number; density: Density };

export function usePrinter() {
  const printer = useRef<Printer | null>(null);
  const [state, setState] = useState<PrinterState>({ phase: "disconnected" });

  async function connect() {
    setState({ phase: "connecting" });
    try {
      const transport = await connectWebBluetooth(() => {
        printer.current = null;
        setState({ phase: "disconnected", error: "Printer disconnected" });
      });
      printer.current = new Printer(transport);
      setState({ phase: "ready", status: await printer.current.status() });
    } catch (error) {
      printer.current = null;
      setState({ phase: "disconnected", error: describe(error) });
    }
  }

  async function print({ ink, width, height, density }: PrintRequest) {
    const session = printer.current;
    if (!session || state.phase !== "ready") return;

    const { status } = state;
    setState({ phase: "printing", status, progress: 0 });
    try {
      await session.print(buildPrintJob(ink, width, height, density), (sent, total) =>
        setState({ phase: "printing", status, progress: sent / total }),
      );
      setState({ phase: "ready", status: await session.status() });
    } catch (error) {
      setState({ phase: "disconnected", error: describe(error) });
    }
  }

  async function disconnect() {
    await printer.current?.close();
  }

  return { state, connect, print, disconnect };
}

function describe(error: unknown): string {
  // The device picker throws NotFoundError when the user cancels it.
  if (error instanceof DOMException && error.name === "NotFoundError") return "No printer chosen";
  return error instanceof Error ? error.message : String(error);
}
