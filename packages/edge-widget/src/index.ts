/**
 * Public entry for `@neetix/edge-widget`.
 *
 * Bundled as an IIFE with global name `NeetixCapture`, so a host site can:
 *   <script src="neetix-edge-widget.js"></script>
 *   <script>NeetixCapture.mount('#neetix-capture', { onCapture(blob, meta){…} })</script>
 *
 * It is also importable as an ES module (`import { mount } from "@neetix/edge-widget"`).
 */

export { mount } from "./widget";
export type {
  CaptureOptions,
  CaptureHandle,
  CaptureMeta,
  CaptureQuality,
  CaptureError,
  WidgetState,
} from "./widget";
export type { WidgetStrings } from "./i18n";
export type {
  NeetixEdge,
  EdgeFace,
  EdgeBox,
  EdgeLivenessResult,
  EdgeLoadOptions,
} from "./edge";

export const version = "0.1.0";
