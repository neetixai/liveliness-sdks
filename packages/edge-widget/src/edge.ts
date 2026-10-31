/**
 * The `@neetix/edge` contract, as consumed by this widget.
 *
 * The on-device engine (Rust -> WASM: YuNet face detection + MiniFASNet passive
 * liveness, fully offline) is being packaged as the npm SDK `@neetix/edge` with
 * the class below. This widget is written ONLY against this interface, so the
 * capture UX is completely decoupled from how the engine is loaded.
 *
 * ```ts
 * class NeetixEdge {
 *   static load(opts?): Promise<NeetixEdge>;
 *   detect(img): EdgeFace[];       // EdgeFace = {score, box:{x,y,w,h}, landmarks:[[x,y]x5]}
 *   liveness(img, face): { live:boolean; score:number; genuine:boolean };
 * }
 * ```
 */

/** Face bounding box, in the pixel coordinates of the passed `ImageData`. */
export interface EdgeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One detected face: detector score, box and the 5 YuNet landmarks. */
export interface EdgeFace {
  /** Detector confidence, 0..1 (higher = more confident). */
  score: number;
  /** Face box in image pixels. */
  box: EdgeBox;
  /** [right-eye, left-eye, nose, right-mouth, left-mouth], each `[x, y]`. */
  landmarks: Array<[number, number]>;
}

/** Passive (single-frame) liveness verdict for one face. */
export interface EdgeLivenessResult {
  /** True when the face is judged a live human (not a printed/screen replay). */
  live: boolean;
  /** Liveness probability, 0..1. */
  score: number;
  /** True when the anti-spoof ensemble agrees the sample is genuine. */
  genuine: boolean;
}

/**
 * The subset of the `@neetix/edge` API this widget uses. `img` is a canvas
 * `ImageData` (RGBA), which is what `CanvasRenderingContext2D.getImageData`
 * returns.
 */
export interface NeetixEdge {
  detect(img: ImageData): EdgeFace[];
  liveness(img: ImageData, face: EdgeFace): EdgeLivenessResult;
}

export interface EdgeLoadOptions {
  /** URL of the engine `.wasm` (and its sibling JS glue), served by the host. */
  wasmUrl?: string;
}

/**
 * Load the on-device edge engine.
 *
 * ─────────────────────────── INTEGRATION POINT (Malay) ───────────────────────────
 * When `@neetix/edge` is published + linked, replace the stub import below with:
 *
 *   const { NeetixEdge } = await import("@neetix/edge");
 *   return NeetixEdge.load({ wasmUrl: opts.wasmUrl });
 *
 * That is the ONLY line that changes — everything downstream (widget, overlay,
 * auto-capture, meta) depends solely on the `NeetixEdge` interface above.
 * ──────────────────────────────────────────────────────────────────────────────────
 */
export async function loadEdgeEngine(opts: EdgeLoadOptions = {}): Promise<NeetixEdge> {
  // Real on-device engine (@neetix/edge: YuNet detect + MiniFASNet liveness,
  // both Apache-2.0, in wasm). The widget only uses detect + liveness, so the
  // recognizer/match weights are not required here. Falls back to the built-in
  // heuristic stub if the package isn't linked in this build.
  try {
    const mod = (await import("@neetix/edge")) as {
      NeetixEdge?: { load(o?: { wasmUrl?: string }): Promise<NeetixEdge> };
    };
    if (mod.NeetixEdge) {
      return await mod.NeetixEdge.load({ wasmUrl: opts.wasmUrl });
    }
  } catch {
    // Package not resolvable in this build — use the stub.
  }
  const { StubNeetixEdge } = await import("./edge-stub");
  return StubNeetixEdge.load(opts);
}
