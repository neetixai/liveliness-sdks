/* tslint:disable */
/* eslint-disable */

/**
 * A loaded detector. Construct ONCE from JS, then call `detect` per frame.
 */
export class Detector {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Detect faces in an RGBA frame (canvas `getImageData().data` layout).
     *
     * Returns a flat `Float32Array`, 15 numbers per face:
     * `[x1, y1, x2, y2, score, lm0x, lm0y, ... lm4x, lm4y]`, in the ORIGINAL
     * image pixel coordinates, sorted by descending score.
     * Landmark order: right-eye, left-eye, nose, right-mouth, left-mouth.
     */
    detect(rgba: Uint8Array, width: number, height: number): Float32Array;
    /**
     * Size in bytes of the embedded model (for the UI/report).
     */
    modelBytes(): number;
    /**
     * Load + optimize the embedded YuNet model. Do this once on page load.
     */
    constructor();
}

/**
 * Two-model MiniFASNet anti-spoof ensemble, running fully in wasm.
 */
export class Liveness {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Assess liveness of the face at box `(x, y, w, h)` in the RGBA frame.
     * Returns `[live_prob, genuine_flag(0|1), p27_live, p40_live]`.
     */
    assess(rgba: Uint8Array, width: number, height: number, x: number, y: number, w: number, h: number): Float32Array;
    modelBytes(): number;
    constructor();
}

/**
 * A loaded EdgeFace recognizer. Construct ONCE from JS, then call `embed`.
 */
export class Recognizer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Produce an L2-NORMALIZED face embedding for the face described by its
     * box `(x, y, bw, bh)` and 5 landmarks (`10 = 5×(lx,ly)`, same order as
     * `Detector.detect`: right-eye, left-eye, nose, right-mouth, left-mouth),
     * all in ORIGINAL image pixel coordinates.
     *
     * The box is accepted for signature/interop parity; alignment is purely
     * landmark-driven (arcface Umeyama), so it is not otherwise used. Returns
     * a `Float32Array` of length `embeddingDim()` (512), unit L2 norm — so a
     * cosine similarity is just the dot product of two `embed` results.
     * Returns an empty vector on invalid input.
     */
    embed(rgba: Uint8Array, width: number, height: number, _x: number, _y: number, _bw: number, _bh: number, landmarks: Float32Array): Float32Array;
    /**
     * Embedding dimensionality (512 for EdgeFace).
     */
    embeddingDim(): number;
    /**
     * Size in bytes of the embedded recognizer model (for the UI/report).
     */
    modelBytes(): number;
    /**
     * Load + optimize the embedded EdgeFace model. Do this once on page load.
     */
    constructor();
}

/**
 * Cosine similarity of two embeddings. If both are already L2-normalized (as
 * `Recognizer.embed` returns), this is just their dot product. Exposed as a
 * convenience — the SDK may equivalently compute the dot product in JS.
 */
export function cosine(a: Float32Array, b: Float32Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_detector_free: (a: number, b: number) => void;
    readonly __wbg_liveness_free: (a: number, b: number) => void;
    readonly cosine: (a: number, b: number, c: number, d: number) => number;
    readonly detector_detect: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly detector_modelBytes: (a: number) => number;
    readonly detector_new: () => [number, number, number];
    readonly liveness_assess: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly liveness_modelBytes: (a: number) => number;
    readonly liveness_new: () => [number, number, number];
    readonly recognizer_embed: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number];
    readonly recognizer_embeddingDim: (a: number) => number;
    readonly recognizer_modelBytes: (a: number) => number;
    readonly recognizer_new: () => [number, number, number];
    readonly __wbg_recognizer_free: (a: number, b: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
