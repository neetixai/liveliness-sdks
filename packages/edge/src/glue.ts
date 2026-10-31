// Minimal, hand-written type surface for the wasm-pack generated glue
// (`wasm/neetix_edge.js`). We type it ourselves rather than lean on the
// generated `.d.ts` so that the optional `Recognizer` export — added by the
// recognizer wasm build — is expressible even before that build lands.

/** YuNet face detector instance. */
export interface WasmDetector {
  /**
   * Flat `Float32Array`, 15 numbers per face, sorted by descending score:
   * `[x1, y1, x2, y2, score, lm0x, lm0y, … lm4x, lm4y]`, original pixel coords.
   */
  detect(rgba: Uint8Array, width: number, height: number): Float32Array;
  modelBytes(): number;
  free(): void;
}

/** MiniFASNet passive-liveness ensemble instance. */
export interface WasmLiveness {
  /** Returns `[live_prob, genuine_flag(0|1), p27_live, p40_live]`. */
  assess(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Float32Array;
  modelBytes(): number;
  free(): void;
}

/**
 * Face recognizer instance — added by the parallel recognizer-wasm build.
 *
 * EXPECTED CONTRACT (what this SDK calls):
 *   `embed(rgba, width, height, landmarks) -> Float32Array(512)`
 * where `landmarks` is the flat 10-float array
 * `[lm0x, lm0y, … lm4x, lm4y]` in original-image pixel coords (exactly the
 * landmark slice this SDK already extracts from `detect`). The 5 points drive
 * the ArcFace-style affine alignment to 112×112 before the embedding is
 * produced. The returned vector should be L2-normalized (the SDK re-normalizes
 * defensively regardless).
 *
 * If the final wasm uses a different embed signature (e.g. box-based instead of
 * landmark-based), adjust exactly one call site: `NeetixEdge._embed`.
 */
export interface WasmRecognizer {
  // Box params are accepted for signature parity with the wasm export; the
  // alignment is landmark-driven (edge-poc Recognizer.embed). Returns a 512-d
  // L2-normalized embedding.
  embed(
    rgba: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    bw: number,
    bh: number,
    landmarks: Float32Array,
  ): Float32Array;
  embeddingDim?(): number;
  modelBytes?(): number;
  free(): void;
}

/** The wasm-pack `--target web` init function. */
export type WasmInit = (
  input?: { module_or_path: string | URL } | string | URL,
) => Promise<unknown>;

/** The shape of the dynamically-imported glue module. */
export interface EdgeWasmGlue {
  default: WasmInit;
  Detector: new () => WasmDetector;
  Liveness: new () => WasmLiveness;
  /** Present only once the recognizer wasm is stitched in. */
  Recognizer?: new () => WasmRecognizer;
}
