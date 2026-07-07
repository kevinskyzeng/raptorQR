/* tslint:disable */
/* eslint-disable */

/**
 * Fixed-buffer QR renderer.
 *
 * One instance per Worker.  The RGBA buffer (`buf`) is allocated once at
 * construction time; `render()` writes pixels in-place and returns the side
 * pixel count.  The caller can then read the result via a zero-copy
 * `Uint8ClampedArray` view into WASM linear memory:
 *
 *   const sidePx = renderer.render(data, version, ecc, scale);
 *   const view   = new Uint8ClampedArray(wasm.memory.buffer, renderer.buf_ptr(), sidePx * sidePx * 4);
 *   const image  = new ImageData(view.slice(), sidePx, sidePx);
 */
export class QrRenderer {
  free(): void;
  [Symbol.dispose](): void;

  constructor();

  /**
   * Render a QR code into the fixed RGBA buffer.
   *
   * @param data    Raw packet bytes to encode.
   * @param version QR version 1-40.
   * @param ecc     ECC level as integer: 0=L, 1=M, 2=Q, 3=H.
   * @param scale   Pixels per module (1-8).
   * @returns       Side pixel count (`sidePx`).  The valid region in the
   *                buffer is `buf_ptr()` … `buf_ptr() + sidePx*sidePx*4`.
   */
  render(data: Uint8Array, version: number, ecc: number, scale: number): number;

  /** Byte offset of the RGBA buffer within WASM linear memory. */
  buf_ptr(): number;

  /** Total byte capacity of the fixed buffer (use `sidePx*sidePx*4` for the valid region). */
  buf_len(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_qrrenderer_free: (a: number, b: number) => void;
  readonly qrrenderer_new: (a: number) => void;
  readonly qrrenderer_render: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly qrrenderer_buf_ptr: (a: number) => number;
  readonly qrrenderer_buf_len: (a: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export: (a: number, b: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * Initialise the WASM module.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>,
): Promise<InitOutput>;
