/**
 * BLE transport for the browser via Web Bluetooth (Chromium browsers on desktop and Android).
 */

import type { Transport } from "../printer";
import { NOTIFY_UUID, SERVICE_UUID, WRITE_UUID } from "../protocol";

export function webBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** Show the browser's device picker and connect. Must run from a user gesture such as a click. */
export async function connectWebBluetooth(onDisconnect?: () => void): Promise<Transport> {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
  if (onDisconnect) device.addEventListener("gattserverdisconnected", onDisconnect);

  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const notify = await service.getCharacteristic(NOTIFY_UUID);
  const writer = await service.getCharacteristic(WRITE_UUID);
  await notify.startNotifications();

  return {
    write: (chunk) => writer.writeValueWithResponse(new Uint8Array(chunk)),
    onData: (listener) =>
      notify.addEventListener("characteristicvaluechanged", () => {
        const value = notify.value!;
        listener(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      }),
    close: async () => server.disconnect(),
  };
}
