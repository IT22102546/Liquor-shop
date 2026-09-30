/**
 * Opening the cash drawer from the browser.
 *
 * A cash drawer is opened by the receipt printer it is plugged into: the printer receives the
 * ESC/POS "drawer kick" command (ESC p) and pulses the drawer's RJ11 cable. How this computer
 * reaches the printer is set once per till computer and kept in this browser:
 *
 *   usb    — Chrome/Edge talk straight to the USB receipt printer (WebUSB).
 *   serial — the printer (or a drawer with its own USB cable) shows up as a COM port (Web Serial).
 *   print  — the printer's own driver opens the drawer whenever something prints; to open it with
 *            no bill we print a small "NO SALE" slip.
 *   off    — no drawer on this computer (openings are still recorded).
 */
import { printThermal, THERMAL_BASE_CSS, escapeHtml } from "./print";

export type DrawerMode = "off" | "usb" | "serial" | "print";
export type DrawerSetup = { mode: DrawerMode; device?: string };

const KEY = "pos_cash_drawer";
/** ESC p m t1 t2 — pulse pin 2, then pin 5 (drawers are wired to one or the other). */
const KICK = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa, 0x1b, 0x70, 0x01, 0x19, 0xfa]);

// WebUSB / Web Serial are not in TypeScript's DOM types yet; these are the parts we use.
type UsbEndpoint = { direction: "in" | "out"; type: string; endpointNumber: number };
type UsbInterface = { interfaceNumber: number; alternate: { endpoints: UsbEndpoint[] } };
type UsbDevice = {
  vendorId: number; productId: number; productName?: string; manufacturerName?: string; opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>; close(): Promise<void>; selectConfiguration(value: number): Promise<void>;
  claimInterface(value: number): Promise<void>; releaseInterface(value: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
};
type SerialPort = {
  open(options: { baudRate: number }): Promise<void>; close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
};
type Nav = Navigator & {
  usb?: { requestDevice(o: { filters: object[] }): Promise<UsbDevice>; getDevices(): Promise<UsbDevice[]> };
  serial?: { requestPort(): Promise<SerialPort>; getPorts(): Promise<SerialPort[]> };
};
const nav = () => (typeof navigator === "undefined" ? undefined : (navigator as Nav));

export const drawerSupport = () => ({ usb: Boolean(nav()?.usb), serial: Boolean(nav()?.serial) });

export function loadDrawerSetup(): DrawerSetup {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as DrawerSetup | null;
    if (saved && ["off", "usb", "serial", "print"].includes(saved.mode)) return saved;
  } catch { /* storage blocked: treat as no drawer */ }
  return { mode: "off" };
}

export function saveDrawerSetup(setup: DrawerSetup) {
  try { localStorage.setItem(KEY, JSON.stringify(setup)); } catch { /* storage blocked */ }
}

const usbName = (device: UsbDevice) => [device.manufacturerName, device.productName].filter(Boolean).join(" ") || `USB device ${device.vendorId.toString(16)}:${device.productId.toString(16)}`;

/** Asks Chrome to let this site use a USB receipt printer. Must run from a click. */
export async function connectUsbPrinter(): Promise<DrawerSetup> {
  const usb = nav()?.usb;
  if (!usb) throw new Error("This browser can't reach USB printers. Use Google Chrome or Microsoft Edge.");
  const device = await usb.requestDevice({ filters: [] });
  return { mode: "usb", device: usbName(device) };
}

/** Asks Chrome to let this site use a COM port (serial printer or USB drawer). Must run from a click. */
export async function connectSerialPort(): Promise<DrawerSetup> {
  const serial = nav()?.serial;
  if (!serial) throw new Error("This browser can't reach COM ports. Use Google Chrome or Microsoft Edge.");
  const port = await serial.requestPort();
  const info = port.getInfo();
  return { mode: "serial", device: info.usbVendorId ? `COM port (USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)})` : "COM port" };
}

async function kickUsb() {
  const devices = (await nav()?.usb?.getDevices()) ?? [];
  const device = devices[0];
  if (!device) throw new Error("The receipt printer isn't connected to this computer. Set it up again in Drawer setup.");
  if (!device.opened) await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  const iface = device.configuration?.interfaces.find((candidate) => candidate.alternate.endpoints.some((endpoint) => endpoint.direction === "out" && endpoint.type === "bulk"));
  if (!iface) throw new Error("This USB device doesn't take printer commands. Choose the receipt printer in Drawer setup.");
  const endpoint = iface.alternate.endpoints.find((candidate) => candidate.direction === "out" && candidate.type === "bulk")!;
  try {
    await device.claimInterface(iface.interfaceNumber);
  } catch {
    throw new Error("The printer is busy with its Windows driver. Use the “Printer opens it when printing” setting, or the printer's COM-port driver.");
  }
  try {
    await device.transferOut(endpoint.endpointNumber, KICK);
  } finally {
    await device.releaseInterface(iface.interfaceNumber).catch(() => undefined);
    await device.close().catch(() => undefined);
  }
}

async function kickSerial() {
  const port = ((await nav()?.serial?.getPorts()) ?? [])[0];
  if (!port) throw new Error("The COM port isn't connected to this computer. Set it up again in Drawer setup.");
  await port.open({ baudRate: 9600 });
  try {
    const writer = port.writable!.getWriter();
    await writer.write(KICK);
    writer.releaseLock();
  } finally {
    await port.close().catch(() => undefined);
  }
}

/** A small slip that makes a driver-controlled printer open the drawer; also a paper trail. */
function printNoSaleSlip(info: { openNo?: string; reason?: string; by?: string; branch?: string }) {
  const at = new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
  const row = (label: string, value?: string) => (value ? `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>` : "");
  const title = info.openNo ?? "NO SALE";
  printThermal(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${THERMAL_BASE_CSS}</style></head><body>
    <div class="band">NO SALE · DRAWER OPENED</div>
    <div class="meta">${row("Number", info.openNo)}${row("Branch", info.branch)}${row("Date", at)}${row("Opened by", info.by)}</div>
    ${info.reason ? `<div class="rule"></div><div class="head">Reason</div><div>${escapeHtml(info.reason)}</div>` : ""}
    <div class="printed">No money was taken for this slip.</div>
  </body></html>`, title);
}

/**
 * Opens the drawer with this computer's setup. `forSale` is true right after a cash bill: in
 * "print" mode the receipt that is about to print opens it, so nothing extra is sent.
 */
export async function kickDrawer(options: { forSale?: boolean; openNo?: string; reason?: string; by?: string; branch?: string } = {}) {
  const setup = loadDrawerSetup();
  if (setup.mode === "usb") return kickUsb();
  if (setup.mode === "serial") return kickSerial();
  if (setup.mode === "print" && !options.forSale) printNoSaleSlip(options);
}
