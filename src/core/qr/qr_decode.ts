/**
 * QR code decoding wrapper.
 *
 * Uses ZXing-C++ via `zxing-wasm/reader` to extract QR payloads from raw
 * pixel data. The wasm file is loaded from the bundled local asset, not the
 * package's default CDN path.
 */
import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
} from 'zxing-wasm/reader';
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export interface QrDecodeResult {
  bytes: Uint8Array;
  version: number;
}

const READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: false,
  tryInvert: true,
  tryDownscale: true,
  textMode: 'Plain',
};

const DEFAULT_MAX_QR_SYMBOLS = 4;

let preparePromise: Promise<unknown> | null = null;

/**
 * Decode a QR code from an `ImageData` object (e.g. from a `<canvas>`).
 *
 * Returns raw bytes and QR version. Returns null if no QR code is found.
 *
 * @param imageData  RGBA pixel data from a canvas (width × height × 4 bytes)
 * @returns The decoded QR payload and version, or `null` if no QR code could be found/decoded.
 */
export function decodeQRFromCanvas(
  imageData: ImageData,
): Promise<QrDecodeResult | null> {
  return decodeImageData(imageData, 1).then((results) => results[0] ?? null);
}

/**
 * Decode up to `maxSymbols` QR codes from an `ImageData` object.
 */
export function decodeQRCodesFromCanvas(
  imageData: ImageData,
  maxSymbols: number = DEFAULT_MAX_QR_SYMBOLS,
): Promise<QrDecodeResult[]> {
  return decodeImageData(imageData, maxSymbols);
}

/**
 * Decode a QR code from a grayscale byte buffer.
 *
 * The grayscale data is expanded into an RGBA `ImageData` before decoding.
 *
 * @param grayBuffer  Flat luma array, length = width × height
 * @param width       Image width in pixels
 * @param height      Image height in pixels
 * @returns The decoded QR payload and version, or `null` if no QR code could be found/decoded.
 */
export function decodeQRFromBuffer(
  grayBuffer: Uint8Array,
  width: number,
  height: number,
): Promise<QrDecodeResult | null> {
  if (grayBuffer.length !== width * height) {
    throw new Error(
      `Buffer size mismatch: expected ${width}×${height} = ${width * height} ` +
      `grayscale pixels, got ${grayBuffer.length}`,
    );
  }

  // Build RGBA buffer where each grayscale value becomes an identical R/G/B
  // with full opacity.
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < grayBuffer.length; i++) {
    const g = grayBuffer[i]!;
    const off = i * 4;
    rgba[off]     = g;  // R
    rgba[off + 1] = g;  // G
    rgba[off + 2] = g;  // B
    rgba[off + 3] = 255; // A
  }

  return decodeImageData(new ImageData(rgba, width, height), 1)
    .then((results) => results[0] ?? null);
}

async function decodeImageData(
  imageData: ImageData,
  maxSymbols: number,
): Promise<QrDecodeResult[]> {
  await prepareReader();
  const results = await readBarcodes(imageData, {
    ...READER_OPTIONS,
    maxNumberOfSymbols: clampMaxSymbols(maxSymbols),
  });

  return results
    .filter((item) => item.isValid && item.symbology === 'QRCode' && item.bytes.length > 0)
    .map((result) => ({
      bytes: new Uint8Array(result.bytes),
      version: parseQRVersion(result.version, result.extra),
    }));
}

function prepareReader(): Promise<unknown> {
  if (!preparePromise) {
    preparePromise = Promise.resolve(
      prepareZXingModule({
        overrides: {
          locateFile: (path) => path.endsWith('.wasm') ? zxingReaderWasmUrl : path,
        },
        equalityFn: Object.is,
        fireImmediately: true,
      }),
    );
  }
  return preparePromise;
}

function parseQRVersion(version: string, extra: string): number {
  const parsedVersion = Number.parseInt(version, 10);
  if (Number.isFinite(parsedVersion) && parsedVersion > 0) {
    return parsedVersion;
  }

  try {
    const parsedExtra = JSON.parse(extra) as { Version?: unknown };
    const extraVersion = Number.parseInt(String(parsedExtra.Version ?? ''), 10);
    if (Number.isFinite(extraVersion) && extraVersion > 0) {
      return extraVersion;
    }
  } catch {
    // Ignore malformed or empty extra metadata.
  }

  return 0;
}

function clampMaxSymbols(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_QR_SYMBOLS;
  return Math.min(DEFAULT_MAX_QR_SYMBOLS, Math.max(1, Math.round(value)));
}
