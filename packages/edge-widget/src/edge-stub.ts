/**
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  STUB — stand-in for the packaged `@neetix/edge` WASM engine.               │
 * │                                                                             │
 * │  This exists ONLY so the widget builds, typechecks and is demoable before   │
 * │  the real npm package is linked. It runs a lightweight, fully on-device     │
 * │  heuristic (skin/luma blob for detection, Laplacian-variance texture for    │
 * │  a liveness proxy) so the positioning meter + auto-capture react to a real  │
 * │  webcam. It is NOT a real face detector or anti-spoof model.                │
 * │                                                                             │
 * │  The real engine (`edge-poc/pkg-web-neetix/`) exposes low-level classes:    │
 * │    Detector.detect(rgba,w,h) -> Float32Array [x1,y1,x2,y2,score, lm x5]     │
 * │    Liveness.assess(rgba,w,h,x,y,w,h) -> [live_prob, genuine, p27, p40]      │
 * │  `@neetix/edge` wraps those into the `NeetixEdge` contract; swap it in at   │
 * │  the integration point in `edge.ts`.                                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import type {
  EdgeFace,
  EdgeLivenessResult,
  EdgeLoadOptions,
  NeetixEdge,
} from "./edge";

function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/** Rough skin-tone test in RGB (Kovac-style bounds). Cheap, per-pixel. */
function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 60 &&
    g > 40 &&
    b > 20 &&
    r > g &&
    r > b &&
    r - g >= 10 &&
    max - min > 12
  );
}

export class StubNeetixEdge implements NeetixEdge {
  private constructor() {}

  static async load(_opts: EdgeLoadOptions = {}): Promise<StubNeetixEdge> {
    // Real engine would fetch + instantiate the wasm from `_opts.wasmUrl` here.
    // The stub is instant; the async signature matches `@neetix/edge` so swapping
    // it in at the integration point needs no widget changes.
    return new StubNeetixEdge();
  }

  detect(img: ImageData): EdgeFace[] {
    const { width: w, height: h, data } = img;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    // Skip pixels for speed; step of 2 is plenty at analysis resolution.
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const p = (y * w + x) * 4;
        if (isSkin(data[p], data[p + 1], data[p + 2])) {
          count++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const sampled = (w * h) / 4;
    const frac = count / sampled;
    // Not enough skin to be a face at capture distance.
    if (count < 40 || frac < 0.015) return [];

    // Bounding box, nudged up a touch to include forehead the skin mask misses.
    let bx = minX;
    let by = Math.max(0, minY - (maxY - minY) * 0.12);
    let bw = Math.max(1, maxX - minX);
    let bh = Math.max(1, maxY - by);
    bx = Math.max(0, Math.min(bx, w - 1));
    by = Math.max(0, Math.min(by, h - 1));
    bw = Math.min(bw, w - bx);
    bh = Math.min(bh, h - by);

    const score = Math.min(0.99, 0.4 + smoothstep(0.015, 0.14, frac) * 0.59);

    // Approximate the 5 YuNet landmarks from the box (right-eye, left-eye,
    // nose, right-mouth, left-mouth). Placeholder geometry only.
    const lx = (fx: number) => bx + bw * fx;
    const ly = (fy: number) => by + bh * fy;
    const landmarks: Array<[number, number]> = [
      [lx(0.34), ly(0.4)],
      [lx(0.66), ly(0.4)],
      [lx(0.5), ly(0.56)],
      [lx(0.38), ly(0.74)],
      [lx(0.62), ly(0.74)],
    ];

    return [{ score, box: { x: bx, y: by, w: bw, h: bh }, landmarks }];
  }

  liveness(img: ImageData, face: EdgeFace): EdgeLivenessResult {
    const { width: w, height: h, data } = img;
    const x0 = Math.max(1, Math.floor(face.box.x));
    const y0 = Math.max(1, Math.floor(face.box.y));
    const x1 = Math.min(w - 1, Math.floor(face.box.x + face.box.w));
    const y1 = Math.min(h - 1, Math.floor(face.box.y + face.box.h));

    // Laplacian variance inside the face box as a texture/"realness" proxy.
    // Flat print/replay surfaces trend low; live skin under lighting trends high.
    let sum = 0;
    let sqSum = 0;
    let n = 0;
    const luma = (p: number) =>
      0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = (y * w + x) * 4;
        const lap =
          4 * luma(p) -
          luma(p - 4) -
          luma(p + 4) -
          luma(p - w * 4) -
          luma(p + w * 4);
        sum += lap;
        sqSum += lap * lap;
        n++;
      }
    }
    const mean = n > 0 ? sum / n : 0;
    const variance = n > 0 ? sqSum / n - mean * mean : 0;

    const score = smoothstep(8, 90, variance);
    const live = score >= 0.5;
    return { live, score, genuine: live };
  }
}
