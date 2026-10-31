// @neetix/edge — on-device face detection + liveness (+ match), 100% in the
// browser. The biometric pixels never leave the device: JS hands the wasm an
// RGBA frame and gets back boxes / verdicts / embeddings. No network, no server.

import type {
  EdgeFace,
  EdgeImage,
  EdgeLiveness,
  EdgeLoadOptions,
  EdgeVerifyOptions,
  EdgeVerifyResult,
} from "./types";
import { EdgeError, EdgeUnsupportedError } from "./types";
import type { EdgeWasmGlue, WasmDetector, WasmLiveness, WasmRecognizer } from "./glue";
import { ImageNormalizer, rgbaOf } from "./image";

/** Score at/above which a face is reported `live`. */
const DEFAULT_LIVE_THRESHOLD = 0.5;
/** Cosine similarity at/above which two faces are treated as the same person. */
const DEFAULT_MATCH_THRESHOLD = 0.36;
/** Number of landmark points YuNet emits per face. */
const N_LANDMARKS = 5;
/** Floats per face in the flat detect output: x1,y1,x2,y2,score + 5×(x,y). */
const FLOATS_PER_FACE = 5 + N_LANDMARKS * 2;

/**
 * The on-device face engine. Construct once with {@link NeetixEdge.load}, then
 * call {@link detect} / {@link liveness} / {@link embed} / {@link verify} as
 * many times as you like.
 *
 * ```ts
 * const edge = await NeetixEdge.load();
 * const faces = edge.detect(videoEl);
 * if (faces[0]) console.log(edge.liveness(videoEl, faces[0]));
 * ```
 */
export class NeetixEdge {
  private readonly detector: WasmDetector;
  private readonly livenessEngine: WasmLiveness;
  private readonly recognizer: WasmRecognizer | null;
  private readonly normalizer = new ImageNormalizer();

  private constructor(
    detector: WasmDetector,
    liveness: WasmLiveness,
    recognizer: WasmRecognizer | null,
  ) {
    this.detector = detector;
    this.livenessEngine = liveness;
    this.recognizer = recognizer;
  }

  /**
   * Fetch + instantiate the wasm and construct the engine. Streaming
   * instantiation is used when the server serves the `.wasm` as
   * `application/wasm`, with an automatic `arrayBuffer` fallback otherwise (both
   * handled by the generated glue).
   */
  static async load(opts: EdgeLoadOptions = {}): Promise<NeetixEdge> {
    // `modelsUrl` is reserved: the current wasm embeds all model weights, so
    // there is nothing extra to fetch. Touch it to keep the option first-class.
    void opts.modelsUrl;

    let glue: EdgeWasmGlue;
    try {
      glue = (await import("../wasm/neetix_edge.js")) as unknown as EdgeWasmGlue;
    } catch (e) {
      throw new EdgeError(`failed to import the wasm glue: ${errText(e)}`);
    }

    try {
      if (opts.wasmUrl != null) {
        await glue.default({ module_or_path: opts.wasmUrl });
      } else {
        await glue.default();
      }
    } catch (e) {
      throw new EdgeError(
        `failed to load the wasm binary${opts.wasmUrl ? ` from ${String(opts.wasmUrl)}` : ""}: ` +
          `${errText(e)} — ensure the .wasm is reachable and served as application/wasm`,
      );
    }

    let detector: WasmDetector;
    let liveness: WasmLiveness;
    try {
      detector = new glue.Detector();
      liveness = new glue.Liveness();
    } catch (e) {
      throw new EdgeError(`failed to initialize the models: ${errText(e)}`);
    }

    // The recognizer is optional — present only once the recognizer wasm is
    // stitched in. Its absence must not break detection/liveness.
    let recognizer: WasmRecognizer | null = null;
    if (typeof glue.Recognizer === "function") {
      try {
        recognizer = new glue.Recognizer();
      } catch {
        recognizer = null;
      }
    }

    return new NeetixEdge(detector, liveness, recognizer);
  }

  /** Whether the loaded wasm can produce embeddings (enables embed/verify). */
  get hasRecognizer(): boolean {
    return this.recognizer !== null;
  }

  /** Detect faces, sorted by descending confidence. */
  detect(image: EdgeImage): EdgeFace[] {
    return this._detect(this.normalizer.toImageData(image));
  }

  /** Passive liveness (anti-spoof) for one previously-detected face. */
  liveness(image: EdgeImage, face: EdgeFace): EdgeLiveness {
    return this._liveness(this.normalizer.toImageData(image), face);
  }

  /**
   * 512-d L2-normalized face embedding for one detected face.
   * @throws {EdgeUnsupportedError} if the loaded wasm has no recognizer.
   */
  embed(image: EdgeImage, face: EdgeFace): Float32Array {
    return this._embed(this.normalizer.toImageData(image), face);
  }

  /**
   * One-call verification: detect + embed both images, cosine-compare, and run
   * passive liveness on the selfie. Returns the match decision plus the raw
   * signals so callers can apply their own policy.
   * @throws {EdgeUnsupportedError} if the loaded wasm has no recognizer.
   */
  verify(selfie: EdgeImage, idPhoto: EdgeImage, opts: EdgeVerifyOptions = {}): EdgeVerifyResult {
    this.requireRecognizer("verify");
    const threshold = opts.threshold ?? DEFAULT_MATCH_THRESHOLD;

    const selfieImg = this.normalizer.toImageData(selfie);
    const selfieFace = this._detect(selfieImg)[0] ?? null;
    // Normalize the ID after reading the selfie's faces — both go through the
    // same reused canvas, so read one fully before drawing the next.
    const idImg = this.normalizer.toImageData(idPhoto);
    const idFace = this._detect(idImg)[0] ?? null;

    const selfieLiveness: EdgeLiveness = selfieFace
      ? this._liveness(selfieImg, selfieFace)
      : { live: false, score: 0, genuine: false };

    let similarity = 0;
    let match = false;
    if (selfieFace && idFace) {
      const a = this._embed(selfieImg, selfieFace);
      const b = this._embed(idImg, idFace);
      similarity = NeetixEdge.cosine(a, b);
      match = similarity >= threshold;
    }

    return { match, similarity, selfieLiveness, selfieFace, idFace };
  }

  /** Cosine similarity of two equal-length vectors, -1..1. */
  static cosine(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new EdgeError(`cosine: length mismatch (${a.length} vs ${b.length})`);
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 0 ? dot / denom : 0;
  }

  /** Release the underlying wasm instances. The engine is unusable afterward. */
  dispose(): void {
    this.detector.free();
    this.livenessEngine.free();
    this.recognizer?.free();
  }

  // --- internals (operate directly on ImageData to avoid re-drawing) ---

  private _detect(image: ImageData): EdgeFace[] {
    const flat = this.detector.detect(rgbaOf(image), image.width, image.height);
    const n = Math.floor(flat.length / FLOATS_PER_FACE);
    const faces: EdgeFace[] = [];
    for (let i = 0; i < n; i++) {
      const o = i * FLOATS_PER_FACE;
      const x1 = flat[o];
      const y1 = flat[o + 1];
      const x2 = flat[o + 2];
      const y2 = flat[o + 3];
      const score = flat[o + 4];
      const landmarks: [number, number][] = [];
      for (let k = 0; k < N_LANDMARKS; k++) {
        landmarks.push([flat[o + 5 + k * 2], flat[o + 6 + k * 2]]);
      }
      faces.push({ score, box: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, landmarks });
    }
    return faces;
  }

  private _liveness(image: ImageData, face: EdgeFace): EdgeLiveness {
    const { x, y, w, h } = face.box;
    const out = this.livenessEngine.assess(rgbaOf(image), image.width, image.height, x, y, w, h);
    const score = out[0] ?? 0;
    const genuine = (out[1] ?? 0) === 1;
    return { live: score >= DEFAULT_LIVE_THRESHOLD, score, genuine };
  }

  private _embed(image: ImageData, face: EdgeFace): Float32Array {
    const rec = this.requireRecognizer("embed");
    const landmarks = flatLandmarks(face);
    const b = face.box;
    // The wasm export takes the box params for signature parity but aligns
    // purely from the 5 landmarks (edge-poc Recognizer.embed). The returned
    // vector is already L2-normalized in-wasm; we renormalize defensively.
    const raw = rec.embed(
      rgbaOf(image),
      image.width,
      image.height,
      b.x,
      b.y,
      b.w,
      b.h,
      landmarks,
    );
    return l2normalize(raw);
  }

  private requireRecognizer(method: string): WasmRecognizer {
    if (!this.recognizer) {
      throw new EdgeUnsupportedError(
        `${method}() needs the face recognizer, but the loaded wasm has none. ` +
          `Detection and liveness work today; the recognizer weights ship separately.`,
      );
    }
    return this.recognizer;
  }
}

function flatLandmarks(face: EdgeFace): Float32Array {
  const lm = new Float32Array(N_LANDMARKS * 2);
  for (let k = 0; k < N_LANDMARKS; k++) {
    const p = face.landmarks[k] ?? [0, 0];
    lm[k * 2] = p[0];
    lm[k * 2 + 1] = p[1];
  }
  return lm;
}

function l2normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) v[i] /= norm;
  }
  return v;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
