// ── ESC/POS constants ────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

const enc = new TextEncoder();

function tl(str: string): number[] {
  return [...Array.from(enc.encode(str)), LF];
}


function qrCodeCmd(data: string, size: number): number[] {
  const encoded = enc.encode(data);
  const len = encoded.length + 3;
  return [
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,          // model 2
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,                  // size
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,                  // error-correction M
    GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff,
      0x31, 0x50, 0x30, ...Array.from(encoded),                     // store data
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,                  // print
  ];
}

// ── Receipt builder ──────────────────────────────────────────────────────────

export interface ReceiptData {
  appTitle: string;
  appSlogan: string;
  customerNama: string;
  customerKelas: string;
  customerNoHape?: string | null;
  customerNis: string;
  customerKamar: string;
  orderCode: string;
  trackUrl: string;
  tglMasuk: string;
  isReprint?: boolean;
  copies?: number;
  paperWidth?: number;
}

function buildOneCopy(d: ReceiptData): number[] {
  const pw        = d.paperWidth ?? 80;
  const lineWidth = pw <= 58 ? 32 : 42;
  const qrSize    = pw <= 58 ? 8 : 9;
  const dash      = '-'.repeat(lineWidth);
  const b: number[] = [];

  // helpers — push inline to avoid stale state between sections
  const reset  = () => b.push(ESC, 0x21, 0x00, ESC, 0x45, 0x00, ESC, 0x61, 0x00);
  const center = () => b.push(ESC, 0x61, 0x01);
  const dblH   = () => b.push(ESC, 0x21, 0x10); // double height only

  // Header
  center(); dblH();
  b.push(...tl(d.appTitle.toUpperCase()));
  reset(); center();
  b.push(...tl(d.appSlogan));
  if (d.isReprint) b.push(...tl('*** CETAK ULANG ***'));
  reset();
  b.push(...tl(dash));

  // Customer info
  center();
  b.push(...tl(`${d.customerNama}`));
  b.push(...tl(`(${d.customerKelas})`));
  if (d.customerNoHape) b.push(...tl(d.customerNoHape));
  b.push(...tl(`${d.customerNis} / ${d.customerKamar}`));
  reset();
  b.push(...tl(dash));

  // Order code
  center();
  b.push(...tl(d.orderCode));
  reset();
  b.push(...tl(dash));

  // QR code: reset semua formatting sebelum command
  reset(); center();
  b.push(...tl(d.trackUrl));
  b.push(...qrCodeCmd(d.trackUrl, qrSize));
  // b.push(LF);

  // Date + footer
  reset(); center();
  b.push(...tl(d.tglMasuk));
  b.push(...tl(dash));
  b.push(...tl('Terima Kasih'));
  reset();

  // Feed + partial cut
  b.push(ESC, 0x64, 0x05);
  b.push(GS, 0x56, 0x56, 0x01);

  return b;
}

export function buildReceipt(d: ReceiptData): Uint8Array {
  const copies = d.copies ?? 1;
  const all: number[] = [ESC, 0x40]; // init printer
  for (let i = 0; i < copies; i++) all.push(...buildOneCopy(d));
  return new Uint8Array(all);
}

// ── Web Bluetooth ────────────────────────────────────────────────────────────

// Known BLE service/characteristic pairs for generic thermal printers
const KNOWN_SERVICES = [
  { svc: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  { svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-1e4d-4bd9-ba61-23c647249616' },
  { svc: '0000ff00-0000-1000-8000-00805f9b34fb', chr: '0000ff02-0000-1000-8000-00805f9b34fb' },
  { svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
];

const STORAGE_KEY = 'bt_printer_name';

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;

export function getConnectedDeviceName(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

async function resolveChar(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  const server = await device.gatt!.connect();
  for (const { svc, chr } of KNOWN_SERVICES) {
    try {
      const service = await server.getPrimaryService(svc);
      return await service.getCharacteristic(chr);
    } catch {
      // try next
    }
  }
  throw new Error('Printer tidak dikenali. Coba printer lain atau hubungi pengembang.');
}

export async function connectPrinter(): Promise<string> {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth tidak didukung di browser ini');

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_SERVICES.map((s) => s.svc),
  });

  const char = await resolveChar(device);
  _device = device;
  _char = char;

  const name = device.name ?? 'Printer Bluetooth';
  localStorage.setItem(STORAGE_KEY, name);

  device.addEventListener('gattserverdisconnected', () => {
    // keep _device reference for auto-reconnect, only clear _char
    _char = null;
  });

  return name;
}

export async function ensureConnected(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_char && _device?.gatt?.connected) return _char;

  if (_device) {
    // reconnect to previously paired device without showing picker
    _char = await resolveChar(_device);
    return _char;
  }

  throw new Error('Printer belum terhubung. Pilih printer di Pengaturan.');
}

export function disconnectPrinter() {
  _device?.gatt?.disconnect();
  _device = null;
  _char = null;
  localStorage.removeItem(STORAGE_KEY);
}

async function writeChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 200;
  for (let i = 0; i < data.length; i += CHUNK) {
    await char.writeValue(data.slice(i, i + CHUNK));
  }
}

export async function printViaBluetooth(data: ReceiptData): Promise<void> {
  const char = await ensureConnected();
  const bytes = buildReceipt(data);
  await writeChunked(char, bytes);
}
