/**
 * Worker pool for parallel QR rendering.
 *
 * Each slot holds one `qr_render.worker` whose WASM `QrRenderer` instance
 * lives for the pool's lifetime.  Jobs are dispatched round-robin across free
 * slots; if all slots are busy, the least-recently-used slot receives the job
 * (it will queue naturally inside the Worker's event loop).
 *
 * A unique `jobId` is used as the correlation key between dispatch and result
 * so that the same `packetIndex` can be queued multiple times without
 * collisions (e.g. during cache warm-up and live playback overlap).
 *
 * @module
 */

import type { EccLevel } from '@/core/qr/qr_encode';
import type { ParallelQRCount } from '@/core/sender/parallel_striping';
import type {
  RenderRequest,
  RenderResult,
  RenderError,
} from '@/workers/qr_render.worker';

// ─── Internals ────────────────────────────────────────────────────────────────

interface PendingJob {
  resolve: (imageData: ImageData) => void;
  reject: (err: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  /** Number of jobs currently dispatched but not yet resolved. */
  inflight: number;
}

// ─── QrWorkerPool ─────────────────────────────────────────────────────────────

export class QrWorkerPool {
  private slots: WorkerSlot[];
  private pending: Map<number, PendingJob> = new Map();
  private nextJobId = 0;

  /**
   * Create a pool with `size` workers.  Workers are spawned immediately;
   * each worker begins initialising its WASM module in the background.
   */
  constructor(size: ParallelQRCount) {
    this.slots = Array.from({ length: size }, () => this.createSlot());
  }

  // ── Public methods ─────────────────────────────────────────────────────────

  /**
   * Render one QR packet and return the resulting `ImageData`.
   *
   * The `packet` buffer is transferred to the worker (zero-copy handoff).
   * The caller must not use `packet` after this call.
   */
  render(
    packet: Uint8Array,
    version: number,
    ecc: EccLevel,
    scale: number,
  ): Promise<ImageData> {
    return new Promise<ImageData>((resolve, reject) => {
      const jobId = this.nextJobId++;
      this.pending.set(jobId, { resolve, reject });

      const slot = this.pickSlot();
      slot.inflight++;

      // Transfer ownership of the packet bytes to the worker.
      const buf = packet.buffer.slice(
        packet.byteOffset,
        packet.byteOffset + packet.byteLength,
      ) as ArrayBuffer;

      const msg: RenderRequest = {
        type: 'render',
        packet: buf,
        version,
        ecc,
        scale,
        jobId,
      };
      slot.worker.postMessage(msg, { transfer: [buf] });
    });
  }

  /**
   * Terminate all workers and reject any in-flight promises.
   * The pool must not be used after calling this.
   */
  terminate(): void {
    for (const slot of this.slots) {
      slot.worker.terminate();
    }
    this.slots = [];
    for (const job of this.pending.values()) {
      job.reject(new Error('QrWorkerPool: pool terminated'));
    }
    this.pending.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private createSlot(): WorkerSlot {
    const worker = new Worker(
      new URL('@/workers/qr_render.worker.ts', import.meta.url),
      { type: 'module' },
    );

    const slot: WorkerSlot = { worker, inflight: 0 };

    worker.onmessage = (e: MessageEvent<RenderResult | RenderError>) => {
      const msg = e.data;
      const job = this.pending.get(msg.jobId);
      if (!job) return;

      this.pending.delete(msg.jobId);
      slot.inflight = Math.max(0, slot.inflight - 1);

      if (msg.type === 'rendered') {
        const clampedData = new Uint8ClampedArray(msg.buffer);
        job.resolve(new ImageData(clampedData, msg.width, msg.height));
      } else {
        job.reject(new Error(msg.message ?? 'QR render worker error'));
      }
    };

    worker.onerror = (ev: ErrorEvent) => {
      // Reject all pending jobs routed to this slot.
      const errorMsg = ev.message ?? 'QR render worker crashed';
      for (const [id, job] of this.pending) {
        job.reject(new Error(errorMsg));
        this.pending.delete(id);
      }
      slot.inflight = 0;
    };

    return slot;
  }

  /**
   * Pick the slot with the fewest in-flight jobs (prefer idle slots).
   * Ties are broken by slot index (stable round-robin).
   */
  private pickSlot(): WorkerSlot {
    let best = this.slots[0]!;
    for (let i = 1; i < this.slots.length; i++) {
      if (this.slots[i]!.inflight < best.inflight) {
        best = this.slots[i]!;
      }
    }
    return best;
  }
}
