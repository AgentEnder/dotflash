/**
 * BLE transport for Bun via noble (CoreBluetooth on macOS).
 */

import noble, { type Peripheral } from "@stoprocent/noble";

import { DEVICE_NAME, NOTIFY_UUID, SERVICE_UUID, type Transport, WRITE_UUID } from "@dotflash/printer";

const bare = (uuid: string) => uuid.replaceAll("-", "");

export async function connectNoble(name = DEVICE_NAME, timeoutMs = 15_000): Promise<Transport> {
  await noble.waitForPoweredOnAsync();

  const found = new Promise<Peripheral>((resolve) => {
    noble.on("discover", (peripheral) => {
      if (peripheral.advertisement.localName === name) resolve(peripheral);
    });
  });
  const timeout = Bun.sleep(timeoutMs).then(() => {
    throw new Error(`${name} not found. Is it on, and is the phone app disconnected?`);
  });

  await noble.startScanningAsync([bare(SERVICE_UUID)], false);
  const peripheral = await Promise.race([found, timeout]).finally(() => noble.stopScanningAsync());
  await peripheral.connectAsync();

  const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
    [bare(SERVICE_UUID)],
    [bare(NOTIFY_UUID), bare(WRITE_UUID)],
  );
  const notify = characteristics.find((c) => c.uuid === bare(NOTIFY_UUID));
  const writer = characteristics.find((c) => c.uuid === bare(WRITE_UUID));
  if (!notify || !writer) throw new Error("printer is missing the Transparent UART characteristics");
  await notify.subscribeAsync();

  return {
    write: (chunk) => writer.writeAsync(Buffer.from(chunk), false),
    onData: (listener) => notify.on("data", (data: Buffer) => listener(new Uint8Array(data))),
    close: () => peripheral.disconnectAsync(),
  };
}

export type Advertisement = { id: string; name?: string; rssi: number; services: string[] };

/** List nearby BLE devices, strongest signal first. */
export async function scan(seconds: number): Promise<Advertisement[]> {
  const seen = new Map<string, Advertisement>();
  noble.on("discover", (peripheral) => {
    const previous = seen.get(peripheral.id);
    seen.set(peripheral.id, {
      id: peripheral.id,
      name: peripheral.advertisement.localName ?? previous?.name,
      rssi: Math.max(peripheral.rssi, previous?.rssi ?? -999),
      services: peripheral.advertisement.serviceUuids?.length
        ? peripheral.advertisement.serviceUuids
        : (previous?.services ?? []),
    });
  });

  await noble.waitForPoweredOnAsync();
  await noble.startScanningAsync([], true);
  await Bun.sleep(seconds * 1000);
  await noble.stopScanningAsync();
  return [...seen.values()].sort((a, b) => b.rssi - a.rssi);
}
