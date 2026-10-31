/**
 * NeetixCapture — an embeddable, drop-in guided face-capture widget.
 *
 * Requests the camera, streams it behind an oval face-guide, runs the on-device
 * `@neetix/edge` engine (detection + passive liveness) every frame, coaches the
 * user with a live positioning/quality meter, and AUTO-CAPTURES a JPEG once the
 * face is well-positioned + live + sharp for ~1s. Everything runs on-device;
 * nothing is uploaded. The host receives `(blob, meta)` and decides what to do.
 */

import {
  loadEdgeEngine,
  type EdgeBox,
  type EdgeFace,
  type EdgeLivenessResult,
  type NeetixEdge,
} from "./edge";
import { resolveStrings, type WidgetStrings } from "./i18n";
import { injectStyles } from "./styles";

/** Lifecycle states, surfaced via `onState`. */
export type WidgetState =
  | "initializing"
  | "requesting-camera"
  | "positioning"
  | "capturing"
  | "done"
  | "error";

/** Structured error codes, surfaced via `onError`. */
export interface CaptureError {
  code:
    | "no-element"
    | "unsupported"
    | "insecure-context"
    | "camera-denied"
    | "no-camera"
    | "engine";
  message: string;
  cause?: unknown;
}

/** Quality/positioning readings at the moment of capture. */
export interface CaptureQuality {
  /** Mean luma inside the face box, 0–255. */
  brightness: number;
  /** Laplacian variance inside the face box (higher = sharper). */
  sharpness: number;
  /** Face height as a fraction of the frame height (distance cue), 0–1. */
  faceFillHeight: number;
  /** Distance of the face centre from the oval centre (0 = centred). */
  centerOffset: number;
}

/** Metadata handed to `onCapture` alongside the JPEG blob. */
export interface CaptureMeta {
  livenessScore: number;
  live: boolean;
  genuine: boolean;
  /** Face box in the captured image's pixel coordinates. */
  faceBox: EdgeBox;
  quality: CaptureQuality;
  /** Captured image dimensions in pixels. */
  width: number;
  height: number;
  /** Epoch ms of capture. */
  timestamp: number;
}

export interface CaptureOptions {
  /** Called with the captured JPEG and its metadata. Required. */
  onCapture: (blob: Blob, meta: CaptureMeta) => void;
  /** Called on any unrecoverable error. */
  onError?: (err: CaptureError) => void;
  /** Called on every lifecycle state change. */
  onState?: (state: WidgetState) => void;
  /** URL of the engine `.wasm`; forwarded to `@neetix/edge`. */
  wasmUrl?: string;
  /** Require passive liveness before auto-capture. Default true. */
  livenessRequired?: boolean;
  /** Auto-capture when well-positioned. Default true. If false, manual only. */
  autoCapture?: boolean;
  /** Oval scale multiplier (0.6–1.4). Default 1. */
  ovalSize?: number;
  /** How long the face must stay good before auto-capture (ms). Default 1000. */
  holdMs?: number;
  /** JPEG quality, 0–1. Default 0.92. */
  jpegQuality?: number;
  /** Mirror the preview (front-camera selfie feel). Default true. */
  mirror?: boolean;
  /** Camera to use. Default "user" (front). */
  facingMode?: "user" | "environment";
  /** Copy overrides for i18n. */
  strings?: Partial<WidgetStrings>;
}

/** Returned by `mount`; controls the running widget. */
export interface CaptureHandle {
  /** Current lifecycle state. */
  readonly state: WidgetState;
  /** Capture the current frame immediately (manual fallback). */
  capture(): void;
  /** Restart after a capture or recoverable error. */
  reset(): void;
  /** Stop analysis, release the camera and remove DOM. */
  stop(): void;
}

// ── Tuning constants ────────────────────────────────────────────────────────
const ANALYSIS_WIDTH = 320;
const DETECT_INTERVAL_MS = 90;
const MIN_FILL = 0.24; // below → too far (move closer)
const MAX_FILL = 0.46; // above → too close (move back; liveness needs context)
const CENTER_TOL = 0.12;
const MIN_BRIGHT = 52;
const MAX_BRIGHT = 225;
const SHARP_MIN = 12;
const SHARP_TARGET = 45;
/** Oval guide geometry as fractions of the stage. */
const OVAL = { cx: 0.5, cy: 0.45, rx: 0.3, ry: 0.36 };

type Stage =
  | "noFace"
  | "moveBack"
  | "moveCloser"
  | "centerFace"
  | "holdStill"
  | "checkingLiveness"
  | "perfect";

interface FrameEval {
  stage: Stage;
  gatePass: boolean; // ready to (auto)capture
  readiness: number; // 0..1 for the meter bar
  face: EdgeFace | null;
  liveness: EdgeLivenessResult | null;
  quality: CaptureQuality;
}

function resolveTarget(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === "string") return document.querySelector<HTMLElement>(target);
  return target ?? null;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Mean luma + Laplacian variance inside a box of an RGBA buffer. */
function analyzeRegion(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  box: EdgeBox,
): { brightness: number; sharpness: number } {
  const x0 = Math.max(1, Math.floor(box.x));
  const y0 = Math.max(1, Math.floor(box.y));
  const x1 = Math.min(w - 1, Math.floor(box.x + box.w));
  const y1 = Math.min(h - 1, Math.floor(box.y + box.h));
  const luma = (p: number) => 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];

  let lumaSum = 0;
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * w + x) * 4;
      const l = luma(p);
      lumaSum += l;
      const lap =
        4 * l - luma(p - 4) - luma(p + 4) - luma(p - w * 4) - luma(p + w * 4);
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return { brightness: 0, sharpness: 0 };
  const lapMean = lapSum / n;
  return { brightness: lumaSum / n, sharpness: lapSq / n - lapMean * lapMean };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function mount(target: string | HTMLElement, options: CaptureOptions): CaptureHandle {
  const strings = resolveStrings(options.strings);
  const livenessRequired = options.livenessRequired ?? true;
  const autoCapture = options.autoCapture ?? true;
  const ovalScale = Math.min(1.4, Math.max(0.6, options.ovalSize ?? 1));
  const holdMs = options.holdMs ?? 1000;
  const jpegQuality = options.jpegQuality ?? 0.92;
  const mirror = options.mirror ?? true;
  const facingMode = options.facingMode ?? "user";

  let state: WidgetState = "initializing";
  const setState = (s: WidgetState) => {
    if (state === s) return;
    state = s;
    options.onState?.(s);
  };
  const fail = (err: CaptureError) => {
    setState("error");
    options.onError?.(err);
  };

  const host = resolveTarget(target);
  if (!host) {
    fail({ code: "no-element", message: `mount target not found: ${String(target)}` });
    return { get state() { return state; }, capture() {}, reset() {}, stop() {} };
  }

  injectStyles();

  // ── DOM ──────────────────────────────────────────────────────────────────
  const root = el("div", "nx-root");
  const stage = el("div", "nx-stage");
  const video = el("video", "nx-video" + (mirror ? " nx-mirror" : ""));
  video.setAttribute("playsinline", "");
  video.muted = true;
  const overlay = el("canvas", "nx-overlay");
  const chips = el("div", "nx-chips");
  const liveChip = el("span", "nx-chip");
  const liveDot = el("span", "nx-dot");
  const liveLabel = el("span");
  liveChip.append(liveDot, liveLabel);
  if (livenessRequired) chips.append(liveChip);
  const guide = el("div", "nx-guide");
  const badge = el("div", "nx-badge");
  badge.textContent = "on-device";
  const errorPanel = el("div", "nx-error");
  errorPanel.hidden = true;
  const errIco = el("div", "nx-error-ico");
  errIco.textContent = "📷";
  const errMsg = el("div", "nx-error-msg");
  const errBtn = el("button", "nx-btn");
  errBtn.textContent = strings.retryBtn;
  errorPanel.append(errIco, errMsg, errBtn);
  stage.append(video, overlay, chips, guide, badge, errorPanel);

  const meter = el("div", "nx-meter");
  const meterFill = el("div", "nx-meter-fill");
  meter.append(meterFill);

  const actions = el("div", "nx-actions");
  const captureBtn = el("button", "nx-btn");
  captureBtn.textContent = strings.captureBtn;
  captureBtn.disabled = true;
  const retakeBtn = el("button", "nx-btn secondary");
  retakeBtn.textContent = strings.retakeBtn;
  retakeBtn.hidden = true;
  actions.append(captureBtn, retakeBtn);

  const privacy = el("div", "nx-privacy");
  privacy.textContent = strings.privacy;

  root.append(stage, meter, actions, privacy);
  host.innerHTML = "";
  host.append(root);

  // ── Runtime state ──────────────────────────────────────────────────────────
  const octx = overlay.getContext("2d")!;
  const analysis = document.createElement("canvas");
  const actx = analysis.getContext("2d", { willReadFrequently: true })!;
  const capCanvas = document.createElement("canvas");
  const capCtx = capCanvas.getContext("2d")!;

  let engine: NeetixEdge | null = null;
  let stream: MediaStream | null = null;
  let raf = 0;
  let stopped = false;
  let lastDetect = 0;
  let okSince: number | null = null;
  let lastEval: FrameEval | null = null;
  let capturing = false;

  const emptyQuality: CaptureQuality = {
    brightness: 0,
    sharpness: 0,
    faceFillHeight: 0,
    centerOffset: 1,
  };

  // ── Detection + positioning evaluation ──────────────────────────────────────
  function evaluate(): FrameEval {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!engine || vw === 0 || vh === 0) {
      return { stage: "noFace", gatePass: false, readiness: 0, face: null, liveness: null, quality: emptyQuality };
    }
    const aw = ANALYSIS_WIDTH;
    const ah = Math.max(2, Math.round((ANALYSIS_WIDTH * vh) / vw));
    if (analysis.width !== aw) analysis.width = aw;
    if (analysis.height !== ah) analysis.height = ah;
    actx.drawImage(video, 0, 0, aw, ah);
    const img = actx.getImageData(0, 0, aw, ah);

    const faces = engine.detect(img);
    const face = faces.length ? faces[0] : null;
    if (!face) {
      return { stage: "noFace", gatePass: false, readiness: 0, face: null, liveness: null, quality: emptyQuality };
    }

    const fill = face.box.h / ah;
    const cx = (face.box.x + face.box.w / 2) / aw;
    const cy = (face.box.y + face.box.h / 2) / ah;
    const offset = Math.hypot(cx - OVAL.cx, cy - OVAL.cy);
    const { brightness, sharpness } = analyzeRegion(img.data, aw, ah, face.box);
    const quality: CaptureQuality = { brightness, sharpness, faceFillHeight: fill, centerOffset: offset };

    // Guidance priority: distance → centering → sharpness/brightness → liveness.
    let stage: Stage;
    let gatePass = false;
    let liveness: EdgeLivenessResult | null = null;

    const fillOk = fill >= MIN_FILL && fill <= MAX_FILL;
    const centerOk = offset <= CENTER_TOL;
    const brightOk = brightness >= MIN_BRIGHT && brightness <= MAX_BRIGHT;
    const sharpOk = sharpness >= SHARP_MIN;

    if (fill > MAX_FILL) stage = "moveBack";
    else if (fill < MIN_FILL) stage = "moveCloser";
    else if (!centerOk) stage = "centerFace";
    else if (!brightOk || !sharpOk) stage = "holdStill";
    else {
      // Positioned and sharp — safe to trust single-frame passive liveness
      // (we are inside the fill band, so no "too close" false-spoof).
      if (livenessRequired) {
        liveness = engine.liveness(img, face);
        if (liveness.live) {
          stage = "perfect";
          gatePass = true;
        } else {
          stage = "checkingLiveness";
        }
      } else {
        stage = "perfect";
        gatePass = true;
      }
    }

    // Readiness meter reflects the limiting factor.
    const fillComp = fillOk
      ? 1
      : fill < MIN_FILL
        ? clamp01(fill / MIN_FILL)
        : clamp01(1 - (fill - MAX_FILL) / MAX_FILL);
    const centerComp = clamp01(1 - offset / (CENTER_TOL * 2));
    const qualComp = brightOk ? clamp01(sharpness / SHARP_TARGET) : 0.2;
    const liveComp = livenessRequired ? (liveness ? liveness.score : 0.4) : 1;
    const readiness = 0.12 + 0.88 * Math.min(fillComp, centerComp, qualComp, liveComp);

    return { stage, gatePass, readiness, face, liveness, quality };
  }

  // ── Overlay + HUD rendering ─────────────────────────────────────────────────
  function severity(stage: Stage): "ok" | "warn" | "bad" {
    if (stage === "perfect") return "ok";
    if (stage === "noFace") return "bad";
    return "warn";
  }

  function render(ev: FrameEval, heldFrac: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = stage.getBoundingClientRect();
    const cw = Math.max(2, Math.round(rect.width * dpr));
    const ch = Math.max(2, Math.round(rect.height * dpr));
    if (overlay.width !== cw) overlay.width = cw;
    if (overlay.height !== ch) overlay.height = ch;

    const sev = severity(ev.stage);
    const stroke = sev === "ok" ? "#22c55e" : sev === "warn" ? "#f59e0b" : "#ef4444";

    octx.clearRect(0, 0, cw, ch);
    // Dim outside the oval.
    octx.fillStyle = "rgba(0,0,0,0.5)";
    octx.fillRect(0, 0, cw, ch);
    const ocx = OVAL.cx * cw;
    const ocy = OVAL.cy * ch;
    const orx = OVAL.rx * ovalScale * cw;
    const ory = OVAL.ry * ovalScale * ch;
    octx.globalCompositeOperation = "destination-out";
    octx.beginPath();
    octx.ellipse(ocx, ocy, orx, ory, 0, 0, Math.PI * 2);
    octx.fill();
    octx.globalCompositeOperation = "source-over";

    // Guide ring.
    octx.lineWidth = Math.max(3, cw * 0.008);
    octx.strokeStyle = stroke;
    octx.beginPath();
    octx.ellipse(ocx, ocy, orx, ory, 0, 0, Math.PI * 2);
    octx.stroke();

    // Hold-progress arc while the gate is passing.
    if (heldFrac > 0) {
      octx.lineWidth = Math.max(5, cw * 0.014);
      octx.strokeStyle = "#22c55e";
      octx.beginPath();
      octx.ellipse(ocx, ocy, orx, ory, 0, -Math.PI / 2, -Math.PI / 2 + heldFrac * Math.PI * 2);
      octx.stroke();
    }

    guide.textContent = strings[stageToKey(ev.stage)];
    meterFill.style.width = Math.round(ev.readiness * 100) + "%";
    meterFill.style.background = ev.readiness > 0.85 ? "#22c55e" : ev.readiness > 0.4 ? "#f59e0b" : "#ef4444";

    if (livenessRequired) {
      let cls = "warn";
      let label = strings.chipChecking;
      if (ev.liveness?.live) {
        cls = "ok";
        label = strings.chipLive;
      } else if (!ev.face || (ev.stage !== "checkingLiveness" && ev.stage !== "perfect")) {
        cls = "";
        label = strings.chipNotLive;
      }
      liveChip.className = "nx-chip" + (cls ? " " + cls : "");
      liveLabel.textContent = label;
    }
  }

  function stageToKey(stage: Stage): keyof WidgetStrings {
    switch (stage) {
      case "noFace": return "noFace";
      case "moveBack": return "moveBack";
      case "moveCloser": return "moveCloser";
      case "centerFace": return "centerFace";
      case "holdStill": return "holdStill";
      case "checkingLiveness": return "checkingLiveness";
      case "perfect": return "perfect";
    }
  }

  // ── Capture ─────────────────────────────────────────────────────────────────
  async function doCapture(ev: FrameEval) {
    if (capturing || stopped) return;
    capturing = true;
    setState("capturing");
    guide.textContent = strings.capturing;
    captureBtn.disabled = true;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    capCanvas.width = vw;
    capCanvas.height = vh;
    // Store the TRUE (un-mirrored) camera image; faceBox is in these coordinates.
    capCtx.drawImage(video, 0, 0, vw, vh);

    const scale = vw / ANALYSIS_WIDTH;
    const box = ev.face
      ? {
          x: Math.round(ev.face.box.x * scale),
          y: Math.round(ev.face.box.y * scale),
          w: Math.round(ev.face.box.w * scale),
          h: Math.round(ev.face.box.h * scale),
        }
      : { x: 0, y: 0, w: vw, h: vh };

    const meta: CaptureMeta = {
      livenessScore: ev.liveness?.score ?? 0,
      live: ev.liveness?.live ?? false,
      genuine: ev.liveness?.genuine ?? false,
      faceBox: box,
      quality: ev.quality,
      width: vw,
      height: vh,
      timestamp: Date.now(),
    };

    try {
      const blob = await toBlob(capCanvas, jpegQuality);
      video.pause();
      cancelAnimationFrame(raf);
      raf = 0;
      setState("done");
      guide.textContent = strings.done;
      captureBtn.hidden = true;
      retakeBtn.hidden = false;
      options.onCapture(blob, meta);
    } catch (e) {
      capturing = false;
      fail({ code: "engine", message: "failed to encode capture", cause: e });
    }
  }

  // ── Main loop ────────────────────────────────────────────────────────────────
  function loop() {
    if (stopped || capturing) return;
    const now = performance.now();
    if (now - lastDetect >= DETECT_INTERVAL_MS || !lastEval) {
      lastDetect = now;
      lastEval = evaluate();
      if (autoCapture && lastEval.gatePass) {
        okSince ??= now;
      } else {
        okSince = null;
      }
    }
    const ev = lastEval;
    const heldFrac =
      autoCapture && ev.gatePass && okSince != null
        ? Math.min(1, (now - okSince) / holdMs)
        : 0;
    render(ev, heldFrac);

    if (autoCapture && ev.gatePass && okSince != null && now - okSince >= holdMs) {
      void doCapture(ev);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  // ── Camera + engine bring-up ─────────────────────────────────────────────────
  function showError(code: CaptureError["code"], message: string, cause?: unknown) {
    errorPanel.hidden = false;
    errIco.textContent = code === "no-camera" ? "🚫" : "📷";
    errMsg.textContent = message;
    errBtn.hidden = code === "unsupported" || code === "insecure-context";
    captureBtn.disabled = true;
    fail({ code, message, cause });
  }

  async function start() {
    stopped = false;
    capturing = false;
    okSince = null;
    lastEval = null;
    errorPanel.hidden = true;
    retakeBtn.hidden = true;
    captureBtn.hidden = false;

    // Environment support.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const insecure = typeof window !== "undefined" && window.isSecureContext === false;
      if (insecure) {
        showError("insecure-context", strings.errUnsupported);
      } else {
        showError("unsupported", strings.errUnsupported);
      }
      return;
    }

    setState("initializing");
    guide.textContent = strings.initializing;
    try {
      engine = await loadEdgeEngine({ wasmUrl: options.wasmUrl });
    } catch (e) {
      showError("engine", strings.errEngine, e);
      return;
    }

    setState("requesting-camera");
    guide.textContent = strings.requestingCamera;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        showError("camera-denied", strings.errCameraDenied, e);
      } else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
        showError("no-camera", strings.errNoCamera, e);
      } else {
        showError("no-camera", strings.errNoCamera, e);
      }
      return;
    }

    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay quirks — the loop tolerates a not-yet-playing video */
    }
    captureBtn.disabled = false;
    setState("positioning");
    lastDetect = 0;
    raf = requestAnimationFrame(loop);
  }

  function releaseCamera() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  // ── Wire controls ────────────────────────────────────────────────────────────
  captureBtn.addEventListener("click", () => {
    if (state !== "positioning") return;
    void doCapture(lastEval ?? {
      stage: "noFace",
      gatePass: false,
      readiness: 0,
      face: null,
      liveness: null,
      quality: emptyQuality,
    });
  });
  retakeBtn.addEventListener("click", () => handle.reset());
  errBtn.addEventListener("click", () => handle.reset());

  const handle: CaptureHandle = {
    get state() {
      return state;
    },
    capture() {
      if (state === "positioning") {
        void doCapture(lastEval ?? {
          stage: "noFace", gatePass: false, readiness: 0, face: null, liveness: null, quality: emptyQuality,
        });
      }
    },
    reset() {
      releaseCamera();
      capturing = false;
      void start();
    },
    stop() {
      stopped = true;
      releaseCamera();
      root.remove();
    },
  };

  void start();
  return handle;
}
