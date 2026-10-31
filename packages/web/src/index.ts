export { NeetixClient, NeetixApiError, DEFAULT_BASE_URL } from "./client.js";
export type {
  ImageInput,
  FaceMatchOptions,
  DocumentIdImages,
  WorkflowRunInput,
} from "./client.js";
export { openCamera } from "./camera.js";
export type { CameraHandle } from "./camera.js";
export { startGuidedCapture } from "./guided-capture.js";
export type {
  GuidedCaptureHandle,
  GuidedCaptureOptions,
  GuidedCaptureResult,
  QualityReadings,
  QualityThresholds,
} from "./guided-capture.js";
export { StreamSession } from "./stream.js";
export type { StreamCallbacks } from "./stream.js";
export * from "./types.js";
