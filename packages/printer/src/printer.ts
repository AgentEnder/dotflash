/**
 * Printer session over any transport that can write acknowledged chunks and receive replies.
 */

import { CHUNK_BYTES, COMMANDS, parseStatus, type PrinterStatus, type PrintJob } from "./protocol";

export interface Transport {
  /** Write one chunk and resolve once the BLE module acknowledges it. */
  write(chunk: Uint8Array): Promise<void>;
  onData(listener: (data: Uint8Array) => void): void;
  close(): Promise<void>;
}

export type Progress = (sentBands: number, totalBands: number) => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export class Printer {
  private replies: Uint8Array[] = [];

  constructor(private readonly transport: Transport) {
    transport.onData((data) => this.replies.push(data));
  }

  /** Write bytes in chunks, waiting for each acknowledgement. */
  async send(data: Uint8Array): Promise<void> {
    for (let offset = 0; offset < data.length; offset += CHUNK_BYTES) {
      await this.transport.write(data.subarray(offset, offset + CHUNK_BYTES));
    }
  }

  /** Send a command and wait for its reply. */
  async query(command: Uint8Array, timeoutMs = 2000): Promise<string> {
    this.replies = [];
    await this.send(command);

    const deadline = Date.now() + timeoutMs;
    while (this.replies.length === 0) {
      if (Date.now() > deadline) throw new Error("printer did not reply");
      await sleep(50);
    }

    // Replies can span notifications, so give stragglers a moment to arrive.
    await sleep(150);
    return new TextDecoder("latin1").decode(concat(this.replies));
  }

  async status(): Promise<PrinterStatus> {
    return parseStatus(await this.query(COMMANDS.queryStatus));
  }

  async print(job: PrintJob, onProgress?: Progress): Promise<void> {
    for (const command of job.setup) await this.send(command);
    for (const [index, band] of job.bands.entries()) {
      await this.send(band);
      onProgress?.(index + 1, job.bands.length);
    }
    await sleep(250);
    await this.send(job.eject);
    await this.drain();
  }

  /**
   * Wait until the printer has worked through everything sent so far.
   *
   * The printer handles bytes in order, so a status reply means every earlier byte was consumed.
   */
  async drain(timeoutMs = 60_000): Promise<void> {
    await this.query(COMMANDS.queryStatus, timeoutMs);
  }

  /** Drain pending work before closing, so the tail of a job is never dropped. */
  async close(): Promise<void> {
    await this.drain();
    await this.transport.close();
  }
}
