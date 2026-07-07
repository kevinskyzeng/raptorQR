/* @ts-self-types="./qrstream_fast_qr_wasm.d.ts" */
// STUB — run src/fast_qr_wasm/build_fast_qr_wasm_colab.py in Google Colab,
// then copy the generated files into src/fast_qr_wasm/wasm/ to replace this stub.

const MISSING_MSG =
  'fast_qr WASM artifacts are not installed. ' +
  'Run src/fast_qr_wasm/build_fast_qr_wasm_colab.py in Google Colab, ' +
  'then copy the generated files into src/fast_qr_wasm/wasm.';

// ─── QrRenderer stub ─────────────────────────────────────────────────────────

const QrRendererFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(() => {});

export class QrRenderer {
  constructor() {
    throw new Error(MISSING_MSG);
  }
  free() {}
  render(_data, _version, _ecc, _scale) {
    throw new Error(MISSING_MSG);
  }
  buf_ptr() {
    return 0;
  }
  buf_len() {
    return 0;
  }
}

if (typeof Symbol !== 'undefined' && Symbol.dispose) {
  QrRenderer.prototype[Symbol.dispose] = QrRenderer.prototype.free;
}

// ─── Init stubs ───────────────────────────────────────────────────────────────

export function initSync(_module) {
  throw new Error(MISSING_MSG);
}

export default async function __wbg_init(_module_or_path) {
  throw new Error(MISSING_MSG);
}
