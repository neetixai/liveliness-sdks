/** All user-facing copy, overridable via the `strings` option (i18n). */
export interface WidgetStrings {
  /** Shown while the wasm engine loads. */
  initializing: string;
  /** Shown while the browser camera-permission prompt is up. */
  requestingCamera: string;
  /** No face found in frame. */
  noFace: string;
  /** Face too small / too far. */
  moveCloser: string;
  /** Face too large / too close (single-frame liveness needs head+shoulders). */
  moveBack: string;
  /** Face off-centre. */
  centerFace: string;
  /** Positioned but not yet steady/sharp. */
  holdStill: string;
  /** Positioned, verifying passive liveness. */
  checkingLiveness: string;
  /** Auto-capture countdown / good to go. */
  perfect: string;
  /** Capturing the frame. */
  capturing: string;
  /** Success. */
  done: string;
  /** Manual capture button. */
  captureBtn: string;
  /** Retake button after capture. */
  retakeBtn: string;
  /** Allow-camera retry button (error panel). */
  retryBtn: string;
  /** Liveness chip: live. */
  chipLive: string;
  /** Liveness chip: checking. */
  chipChecking: string;
  /** Liveness chip: not verified yet. */
  chipNotLive: string;
  /** Error: user denied camera permission. */
  errCameraDenied: string;
  /** Error: no camera hardware. */
  errNoCamera: string;
  /** Error: browser unsupported (no getUserMedia / not secure context). */
  errUnsupported: string;
  /** Error: engine failed to load. */
  errEngine: string;
  /** Privacy footer line. */
  privacy: string;
}

export const DEFAULT_STRINGS: WidgetStrings = {
  initializing: "Starting secure on-device engine…",
  requestingCamera: "Allow camera access to continue",
  noFace: "Position your face inside the oval",
  moveCloser: "Move a little closer",
  moveBack: "Move back — keep your head and shoulders in view",
  centerFace: "Center your face in the oval",
  holdStill: "Hold still…",
  checkingLiveness: "Checking liveness…",
  perfect: "Perfect — hold it",
  capturing: "Capturing…",
  done: "Captured ✓",
  captureBtn: "Capture",
  retakeBtn: "Retake",
  retryBtn: "Allow camera",
  chipLive: "Live",
  chipChecking: "Checking…",
  chipNotLive: "Liveness",
  errCameraDenied:
    "Camera permission was blocked. Enable it in your browser settings and retry.",
  errNoCamera: "No camera was found on this device.",
  errUnsupported:
    "This browser can’t access the camera. Try a modern browser over HTTPS.",
  errEngine: "The on-device engine failed to load. Please retry.",
  privacy: "🔒 Your face never leaves this device — capture runs fully offline.",
};

export function resolveStrings(overrides?: Partial<WidgetStrings>): WidgetStrings {
  return { ...DEFAULT_STRINGS, ...(overrides ?? {}) };
}
