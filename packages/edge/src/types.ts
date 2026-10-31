// Public types for @neetix/edge — the on-device face engine.
//
// All coordinates are in the ORIGINAL image's pixel space (top-left origin),
// matching what you would draw on a <canvas> of the same size.

/** Any image source the engine accepts. Normalized to `ImageData` internally. */
export type EdgeImage = ImageData | HTMLCanvasElement | HTMLVideoElement;

/**
 * One detected face.
 *
 * `box` is axis-aligned in pixels. `landmarks` are 5 points in the fixed order
 * used by YuNet: right-eye, left-eye, nose, right-mouth-corner, left-mouth-corner.
 */
export interface EdgeFace {
  /** Detector confidence, 0..1. */
  score: number;
  /** Axis-aligned face box, pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** 5 landmark points `[x, y]`, pixels. */
  landmarks: [number, number][];
}

/** Passive liveness (anti-spoof) verdict for a single face. */
export interface EdgeLiveness {
  /** `true` when `score` clears the live threshold (default 0.5). */
  live: boolean;
  /** Live probability, 0..1 (MiniFASNet 2-model ensemble). */
  score: number;
  /** The ensemble's own argmax classified this crop as a genuine live face. */
  genuine: boolean;
}

/** Result of the one-call {@link NeetixEdge.verify} convenience flow. */
export interface EdgeVerifyResult {
  /** `similarity >= threshold`. */
  match: boolean;
  /** Cosine similarity of the two 512-d embeddings, -1..1. */
  similarity: number;
  /** Passive liveness assessed on the selfie's primary face. */
  selfieLiveness: EdgeLiveness;
  /** Primary face found in the selfie, or `null` if none. */
  selfieFace: EdgeFace | null;
  /** Primary face found in the ID photo, or `null` if none. */
  idFace: EdgeFace | null;
}

/** Options for {@link NeetixEdge.load}. */
export interface EdgeLoadOptions {
  /**
   * Where to fetch the `.wasm` binary from. Defaults to the copy bundled next
   * to the glue (resolved relative to the package). Pass an absolute URL to
   * self-host or serve from a CDN. The file MUST be served with the
   * `application/wasm` MIME type for streaming instantiation.
   */
  wasmUrl?: string | URL;
  /**
   * Reserved for future builds that fetch model weights separately. The current
   * build embeds every model inside the `.wasm`, so this is ignored today.
   */
  modelsUrl?: string | URL;
}

/** Options for {@link NeetixEdge.verify}. */
export interface EdgeVerifyOptions {
  /** Cosine threshold above which faces are treated as the same person. */
  threshold?: number;
}

/** Base class for all errors thrown by this SDK. */
export class EdgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeError";
  }
}

/**
 * Thrown when a capability is requested that the currently-loaded wasm does not
 * provide — today this is {@link NeetixEdge.embed} / {@link NeetixEdge.verify}
 * when the wasm has no `Recognizer` export.
 */
export class EdgeUnsupportedError extends EdgeError {
  constructor(message: string) {
    super(message);
    this.name = "EdgeUnsupportedError";
  }
}
