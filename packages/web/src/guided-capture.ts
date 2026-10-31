/**
 * GuidedCapture — a framework-agnostic selfie-capture UX on top of the plain
 * camera helper. Streams `getUserMedia` into a `<video>`, draws an oval
 * face-guide overlay on a `<canvas>`, measures live frame quality
 * (brightness / sharpness / face-size heuristic) and auto-captures a JPEG
 * once quality holds above thresholds for a sustained period.
 *
 * DOM-only (like `camera.ts`); the API client itself has no DOM dependency.
 * No dependencies beyond the browser.
 *
 * ```ts
 * const guide = await startGuidedCapture({ video, overlay });
 * const { blob, readings } = await guide.result; // auto-captured JPEG
 * guide.stop();
 * await client.liveness(blob);
 * ```
 */

import { openCamera, type CameraHandle } from "./camera.js";

/** One quality measurement of the region inside the oval guide. */
export interface QualityReadings {
  /** Mean luma inside the oval, 0–255. */
  brightness: number;
  /** Laplacian variance on a downsampled grayscale frame (higher = sharper). */
  sharpness: number;
  /**
   * Face-size heuristic: fraction (0–1) of the oval whose luma deviates from
   * the ring just outside the oval — i.e. how much of the guide a subject
   * fills. Not a face detector; a fill heuristic.
   */
  faceSize: number;
  /** True when every reading is within `QualityThresholds`. */
  ok: boolean;
  /** Milliseconds quality has been continuously ok (0 when not ok). */
  heldMs: number;
}

/** Acceptance bounds for auto-capture. */
export interface QualityThresholds {
  /** Minimum mean luma inside the oval (avoid dark frames). Default 60. */
  minBrightness: number;
  /** Maximum mean luma inside the oval (avoid blown-out frames). Default 210. */
  maxBrightness: number;
  /** Minimum Laplacian variance (avoid blur). Default 30. */
  minSharpness: number;
  /** Minimum oval fill fraction (face close enough). Default 0.3. */
  minFaceSize: number;
}

export interface GuidedCaptureOptions {
  /** Video element to stream the camera into. */
  video: HTMLVideoElement;
  /**
   * Canvas positioned over the video (same box; e.g. absolutely positioned).
   * The overlay is drawn at the video's intrinsic resolution.
   */
  overlay: HTMLCanvasElement;
  /** Quality bounds; partial overrides are merged onto the defaults. */
  thresholds?: Partial<QualityThresholds>;
  /** How long quality must hold before auto-capture (ms). Default 1000. */
  holdMs?: number;
  /** Analysis cadence (ms). Default 100. */
  intervalMs?: number;
  /** JPEG quality for the captured frame. Default 0.92 (as `camera.ts`). */
  quality?: number;
  /** Mirror the overlay drawing (front camera preview). Default true. */
  mirrored?: boolean;
  /** Camera constraints; defaults to the front camera (as `openCamera`). */
  constraints?: MediaStreamConstraints;
  /** Live per-tick quality callback (drive your own meter UI). */
  onQuality?: (q: QualityReadings) => void;
}

export interface GuidedCaptureResult {
  /** The captured selfie as a JPEG Blob. */
  blob: Blob;
  /** Quality readings at the moment of capture. */
  readings: QualityReadings;
}

export interface GuidedCaptureHandle {
  readonly video: HTMLVideoElement;
  readonly overlay: HTMLCanvasElement;
  /** Resolves with the auto-captured frame (or the first `captureNow`). */
  readonly result: Promise<GuidedCaptureResult>;
  /** Latest quality readings (undefined before the first analysis tick). */
  readonly readings: QualityReadings | undefined;
  /** Capture immediately, regardless of quality; also settles `result`. */
  captureNow(): Promise<GuidedCaptureResult>;
  /** Stop analysis, release the camera, clear the overlay. */
  stop(): void;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minBrightness: 60,
  maxBrightness: 210,
  minSharpness: 30,
  minFaceSize: 0.3,
};

/** Downsampled analysis size (longest edge); small keeps the meter cheap. */
const ANALYSIS_SIZE = 96;

/** Oval guide geometry, as fractions of the frame (portrait face framing). */
const OVAL = { cx: 0.5, cy: 0.46, rx: 0.3, ry: 0.4 };

/**
 * Open the front camera with an oval face-guide overlay and a live quality
 * meter; auto-captures a JPEG once quality holds for `holdMs`.
 */
export async function startGuidedCapture(
  opts: GuidedCaptureOptions,
): Promise<GuidedCaptureHandle> {
  const thresholds: QualityThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...opts.thresholds,
  };
  const holdMs = opts.holdMs ?? 1000;
  const intervalMs = opts.intervalMs ?? 100;
  const mirrored = opts.mirrored ?? true;

  const cam: CameraHandle = await openCamera(
    opts.video,
    opts.constraints ?? { video: { facingMode: "user" } },
  );

  const analysis = document.createElement("canvas");
  const analysisCtx = analysis.getContext("2d", { willReadFrequently: true });
  if (!analysisCtx) throw new Error("2d canvas context unavailable");

  let latest: QualityReadings | undefined;
  let okSince: number | undefined;
  let stopped = false;
  let settled = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  let resolveResult!: (r: GuidedCaptureResult) => void;
  let rejectResult!: (e: Error) => void;
  const result = new Promise<GuidedCaptureResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  async function capture(readings: QualityReadings): Promise<GuidedCaptureResult> {
    const blob = await cam.capture(opts.quality ?? 0.92);
    const captured: GuidedCaptureResult = { blob, readings };
    if (!settled) {
      settled = true;
      resolveResult(captured);
    }
    return captured;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
    cam.stop();
    const ctx = opts.overlay.getContext("2d");
    ctx?.clearRect(0, 0, opts.overlay.width, opts.overlay.height);
    if (!settled) {
      settled = true;
      rejectResult(new Error("guided capture stopped before a frame was captured"));
    }
  }

  function tick(): void {
    if (stopped) return;
    const { video } = opts;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const readings = analyze(video, analysis, analysisCtx!, thresholds);
    const now = Date.now();
    if (readings.ok) {
      okSince ??= now;
      readings.heldMs = now - okSince;
    } else {
      okSince = undefined;
    }
    latest = readings;

    drawOverlay(opts.overlay, video, readings, holdMs, mirrored);
    opts.onQuality?.(readings);

    if (!settled && readings.heldMs >= holdMs) {
      okSince = undefined; // re-arm in case capture fails
      void capture(readings).catch(() => undefined);
    }
  }

  timer = setInterval(tick, intervalMs);
  tick();

  return {
    video: opts.video,
    overlay: opts.overlay,
    result,
    get readings() {
      return latest;
    },
    captureNow() {
      if (stopped) return Promise.reject(new Error("guided capture stopped"));
      return capture(
        latest ?? { brightness: 0, sharpness: 0, faceSize: 0, ok: false, heldMs: 0 },
      );
    },
    stop,
  };
}

/** Measure brightness / sharpness / oval fill on a downsampled frame. */
function analyze(
  video: HTMLVideoElement,
  analysis: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  thresholds: QualityThresholds,
): QualityReadings {
  const scale = ANALYSIS_SIZE / Math.max(video.videoWidth, video.videoHeight);
  const w = Math.max(2, Math.round(video.videoWidth * scale));
  const h = Math.max(2, Math.round(video.videoHeight * scale));
  if (analysis.width !== w) analysis.width = w;
  if (analysis.height !== h) analysis.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale plane (Rec. 601 luma).
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // Indices are in-bounds by the loop bounds; `!` keeps this allocation-free
    // under `noUncheckedIndexedAccess`.
    gray[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
  }

  const cx = OVAL.cx * w;
  const cy = OVAL.cy * h;
  const rx = OVAL.rx * w;
  const ry = OVAL.ry * h;
  const inOval = (x: number, y: number): number => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy; // <=1 inside; (1,1.44] = ring just outside
  };

  // Brightness: mean luma inside the oval. Also collect the ring outside it
  // (background reference for the face-size heuristic).
  let sum = 0;
  let count = 0;
  let ringSum = 0;
  let ringCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = inOval(x, y);
      if (d <= 1) {
        sum += gray[y * w + x]!;
        count++;
      } else if (d <= 1.44) {
        ringSum += gray[y * w + x]!;
        ringCount++;
      }
    }
  }
  const brightness = count > 0 ? sum / count : 0;
  const ringMean = ringCount > 0 ? ringSum / ringCount : brightness;

  // Sharpness: variance of a 4-neighbour Laplacian inside the oval.
  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (inOval(x, y) > 1) continue;
      const i = y * w + x;
      const lap =
        4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const sharpness = lapCount > 0 ? lapSqSum / lapCount - lapMean * lapMean : 0;

  // Face-size heuristic: how much of the oval deviates from the background
  // ring's mean luma. A close, centred face fills the oval with tones unlike
  // the background; an empty scene reads near 0.
  let filled = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inOval(x, y) > 1) continue;
      if (Math.abs(gray[y * w + x]! - ringMean) > 24) filled++;
    }
  }
  const faceSize = count > 0 ? filled / count : 0;

  const ok =
    brightness >= thresholds.minBrightness &&
    brightness <= thresholds.maxBrightness &&
    sharpness >= thresholds.minSharpness &&
    faceSize >= thresholds.minFaceSize;

  return { brightness, sharpness, faceSize, ok, heldMs: 0 };
}

/** Dimmed backdrop with an oval cutout, quality-coloured stroke + hold arc. */
function drawOverlay(
  overlay: HTMLCanvasElement,
  video: HTMLVideoElement,
  readings: QualityReadings,
  holdMs: number,
  mirrored: boolean,
): void {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (overlay.width !== w) overlay.width = w;
  if (overlay.height !== h) overlay.height = h;
  const ctx = overlay.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  const cx = OVAL.cx * w;
  const cy = OVAL.cy * h;
  const rx = OVAL.rx * w;
  const ry = OVAL.ry * h;

  // Dim everything outside the oval.
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Oval stroke: red (bad) → amber (partial) → green (ok).
  const partial = readings.faceSize > 0.1 || readings.sharpness > 10;
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeStyle = readings.ok ? "#22c55e" : partial ? "#f59e0b" : "#ef4444";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Hold-progress arc along the oval while quality is held.
  if (readings.ok && readings.heldMs > 0) {
    const progress = Math.min(1, readings.heldMs / holdMs);
    ctx.lineWidth = Math.max(5, w * 0.01);
    ctx.strokeStyle = "#22c55e";
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      rx,
      ry,
      0,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}
